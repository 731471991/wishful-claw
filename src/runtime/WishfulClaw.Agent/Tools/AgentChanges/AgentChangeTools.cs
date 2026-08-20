using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent.Tools.AgentChanges;

/// <summary>
/// In-memory file change tracking for Agent operations.
/// Records file snapshots before/after Agent edits and supports rollback.
/// </summary>
public static class AgentChangeTools
{
    private const int InlineTextSnapshotLimitBytes = 64 * 1024;
    private static readonly UTF8Encoding Utf8NoBom = new(encoderShouldEmitUTF8Identifier: false);

    // In-memory storage: runId → change set
    private static readonly ConcurrentDictionary<string, ChangeSet> _changeSets = new();

    // ── Public API (called by FileWriteTool/FileEditTool to record changes) ──

    public static void RecordChange(
        string runId,
        string? sessionId,
        string filePath,
        bool beforeExists,
        string? beforeText,
        string afterText)
    {
        if (string.IsNullOrEmpty(runId)) return;

        var before = BuildSnapshot(beforeExists, beforeText);
        var after = BuildSnapshot(true, afterText);

        // Skip if nothing changed
        if (before.Hash == after.Hash && before.Exists == after.Exists) return;

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var set = _changeSets.GetOrAdd(runId, _ => new ChangeSet
        {
            RunId = runId,
            SessionId = sessionId,
            Status = "open",
            CreatedAt = now,
            UpdatedAt = now
        });

        var change = new FileChange
        {
            Id = $"{runId}:{set.Changes.Count + 1}",
            RunId = runId,
            SessionId = sessionId,
            FilePath = filePath,
            Transport = "local",
            Op = beforeExists ? "modify" : "create",
            Status = "open",
            Before = before,
            After = after,
            CreatedAt = now
        };

        set.Changes.Add(change);
        set.UpdatedAt = now;
    }

    // ── IPC Handlers ──

    public static Task<WorkerResponse> ListSessionHydrated(JsonElement parameters)
    {
        try
        {
            var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim();
            if (string.IsNullOrEmpty(sessionId))
            {
                return Task.FromResult(SuccessResult(w =>
                {
                    w.WritePropertyName("changeSets");
                    w.WriteStartArray();
                    w.WriteEndArray();
                }));
            }

            var sets = _changeSets.Values
                .Where(cs => cs.SessionId == sessionId)
                .ToList();

            return Task.FromResult(SuccessResult(w =>
            {
                w.WritePropertyName("changeSets");
                w.WriteStartArray();
                foreach (var cs in sets)
                    WriteHydratedChangeSet(w, cs);
                w.WriteEndArray();
            }));
        }
        catch (Exception ex)
        {
            return Task.FromResult(ErrorResult(ex.Message));
        }
    }

    public static Task<WorkerResponse> GetHydrated(JsonElement parameters)
    {
        try
        {
            var runId = JsonHelpers.GetString(parameters, "runId");
            if (string.IsNullOrEmpty(runId))
            {
                return Task.FromResult(ErrorResult("runId is required"));
            }

            if (!_changeSets.TryGetValue(runId, out var set))
            {
                return Task.FromResult(SuccessResult(w =>
                {
                    w.WriteNull("changeSet");
                }));
            }

            return Task.FromResult(SuccessResult(w =>
            {
                w.WritePropertyName("changeSet");
                WriteHydratedChangeSet(w, set);
            }));
        }
        catch (Exception ex)
        {
            return Task.FromResult(ErrorResult(ex.Message));
        }
    }

    public static Task<WorkerResponse> DiffLocal(JsonElement parameters)
    {
        try
        {
            var runId = JsonHelpers.GetString(parameters, "runId");
            var changeId = JsonHelpers.GetString(parameters, "changeId");
            if (string.IsNullOrEmpty(runId) || string.IsNullOrEmpty(changeId))
            {
                return Task.FromResult(ErrorResult("runId and changeId are required"));
            }

            var found = FindChange(runId, changeId);
            if (found is null)
            {
                return Task.FromResult(WorkerResponse.FromWriter(w =>
                {
                    w.WriteStartObject();
                    w.WriteBoolean("success", true);
                    w.WriteBoolean("handled", true);
                    w.WriteBoolean("notFound", true);
                    w.WriteEndObject();
                }));
            }

            var change = found.Value.Change;
            var beforeText = ResolveSnapshotFullText(change.Before);
            var afterText = ResolveSnapshotFullText(change.After);

            // Try to read current file content if after snapshot is incomplete
            if (afterText is null && change.Status == "open")
            {
                afterText = TryReadLocalText(change.FilePath);
            }

            if (beforeText is null || afterText is null)
            {
                return Task.FromResult(WorkerResponse.FromWriter(w =>
                {
                    w.WriteStartObject();
                    w.WriteBoolean("success", false);
                    w.WriteBoolean("handled", true);
                    w.WriteBoolean("notFound", false);
                    w.WriteString("error", "Full diff is unavailable for this change");
                    w.WriteEndObject();
                }));
            }

            return Task.FromResult(WorkerResponse.FromWriter(w =>
            {
                w.WriteStartObject();
                w.WriteBoolean("success", true);
                w.WriteBoolean("handled", true);
                w.WriteBoolean("notFound", false);
                w.WriteString("beforeText", beforeText);
                w.WriteString("afterText", afterText);
                w.WriteEndObject();
            }));
        }
        catch (Exception ex)
        {
            return Task.FromResult(ErrorResult(ex.Message));
        }
    }

    public static Task<WorkerResponse> RollbackLocalChange(JsonElement parameters)
    {
        try
        {
            if (!parameters.TryGetProperty("change", out var changeElement) ||
                changeElement.ValueKind != JsonValueKind.Object)
            {
                return Task.FromResult(ErrorResult("Missing required agent change object: change"));
            }

            var filePath = JsonHelpers.GetString(changeElement, "filePath");
            var op = JsonHelpers.GetString(changeElement, "op");
            var status = JsonHelpers.GetString(changeElement, "status");
            var beforeExists = JsonHelpers.GetBool(changeElement, "beforeExists", false);

            if (string.IsNullOrEmpty(filePath))
            {
                return Task.FromResult(ErrorResult("change.filePath is required"));
            }

            // Already reverted?
            if (status == "reverted")
            {
                return Task.FromResult(RollbackResult(true, true, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
            }

            // Perform rollback
            if (op == "create")
            {
                // File was created by Agent → delete it
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }
            }
            else
            {
                // File was modified → restore original content
                var beforeText = ResolveBeforeText(changeElement);
                if (beforeExists && beforeText is null)
                {
                    return Task.FromResult(RollbackResult(false, true, null,
                        "Original content was not captured in full (file too large at capture time)"));
                }
                File.WriteAllText(filePath, beforeText ?? string.Empty, Utf8NoBom);
            }

            // Update in-memory status
            var runId = JsonHelpers.GetString(changeElement, "runId");
            var changeId = JsonHelpers.GetString(changeElement, "id");
            if (!string.IsNullOrEmpty(runId) && !string.IsNullOrEmpty(changeId) &&
                _changeSets.TryGetValue(runId, out var set))
            {
                var change = set.Changes.FirstOrDefault(c => c.Id == changeId);
                if (change is not null)
                {
                    change.Status = "reverted";
                    change.RevertedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                }
                set.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            }

            return Task.FromResult(RollbackResult(true, true, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
        }
        catch (Exception ex)
        {
            return Task.FromResult(ErrorResult(ex.Message));
        }
    }

    // ── Helpers ──

    private static FileSnapshot BuildSnapshot(bool exists, string? text)
    {
        if (!exists || text is null)
        {
            return new FileSnapshot { Exists = exists, Hash = null, Size = 0 };
        }

        var size = Encoding.UTF8.GetByteCount(text);
        var hash = HashText(text);
        var lineCount = text.Length == 0 ? 0 : text.Replace("\r\n", "\n").Split('\n').Length;

        if (size <= InlineTextSnapshotLimitBytes)
        {
            return new FileSnapshot
            {
                Exists = true,
                Text = text,
                FullText = text,
                Hash = hash,
                Size = size,
                LineCount = lineCount
            };
        }

        return new FileSnapshot
        {
            Exists = true,
            PreviewText = text[..Math.Min(1200, text.Length)],
            TextOmitted = true,
            Hash = hash,
            Size = size,
            LineCount = lineCount
        };
    }

    private static string HashText(string text)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(text));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string? ResolveSnapshotFullText(FileSnapshot snapshot)
    {
        if (!snapshot.Exists) return string.Empty;
        return snapshot.FullText ?? snapshot.Text;
    }

    private static string? TryReadLocalText(string filePath)
    {
        try
        {
            return File.Exists(filePath) ? File.ReadAllText(filePath, Utf8NoBom) : null;
        }
        catch
        {
            return null;
        }
    }

    private static string? ResolveBeforeText(JsonElement changeElement)
    {
        if (changeElement.TryGetProperty("before", out var before) &&
            before.ValueKind == JsonValueKind.Object)
        {
            if (before.TryGetProperty("fullText", out var fullText) && fullText.ValueKind == JsonValueKind.String)
            {
                return fullText.GetString();
            }
            if (before.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
            {
                return text.GetString();
            }
        }
        return null;
    }

    private static (ChangeSet ChangeSet, FileChange Change)? FindChange(string runId, string changeId)
    {
        if (!_changeSets.TryGetValue(runId, out var set)) return null;
        var change = set.Changes.FirstOrDefault(c => c.Id == changeId);
        return change is null ? null : (set, change);
    }

    private static void WriteHydratedChangeSet(Utf8JsonWriter w, ChangeSet set)
    {
        w.WriteStartObject();
        w.WriteString("runId", set.RunId);
        w.WriteString("sessionId", set.SessionId);
        w.WriteString("status", set.Status);
        w.WritePropertyName("changes");
        w.WriteStartArray();
        foreach (var c in set.Changes)
        {
            w.WriteStartObject();
            w.WriteString("id", c.Id);
            w.WriteString("runId", c.RunId);
            w.WriteString("sessionId", c.SessionId);
            w.WriteString("filePath", c.FilePath);
            w.WriteString("transport", c.Transport);
            w.WriteString("op", c.Op);
            w.WriteString("status", c.Status);
            w.WritePropertyName("before");
            WriteSnapshot(w, c.Before);
            w.WritePropertyName("after");
            WriteSnapshot(w, c.After);
            w.WriteNumber("createdAt", c.CreatedAt);
            if (c.RevertedAt.HasValue)
                w.WriteNumber("revertedAt", c.RevertedAt.Value);
            else
                w.WriteNull("revertedAt");
            w.WriteEndObject();
        }
        w.WriteEndArray();
        w.WriteNumber("createdAt", set.CreatedAt);
        w.WriteNumber("updatedAt", set.UpdatedAt);
        w.WriteEndObject();
    }

    private static void WriteSnapshot(Utf8JsonWriter w, FileSnapshot snap)
    {
        w.WriteStartObject();
        w.WriteBoolean("exists", snap.Exists);
        w.WriteString("text", snap.Text);
        w.WriteString("fullText", snap.FullText);
        w.WriteString("previewText", snap.PreviewText);
        if (snap.TextOmitted.HasValue)
            w.WriteBoolean("textOmitted", snap.TextOmitted.Value);
        else
            w.WriteNull("textOmitted");
        w.WriteString("hash", snap.Hash);
        w.WriteNumber("size", snap.Size);
        if (snap.LineCount.HasValue)
            w.WriteNumber("lineCount", snap.LineCount.Value);
        else
            w.WriteNull("lineCount");
        w.WriteEndObject();
    }

    private static WorkerResponse SuccessResult(Action<Utf8JsonWriter> writeProperties) =>
        WorkerResponse.FromWriter(w =>
        {
            w.WriteStartObject();
            w.WriteBoolean("success", true);
            writeProperties(w);
            w.WriteEndObject();
        });

    private static WorkerResponse ErrorResult(string error) =>
        WorkerResponse.FromWriter(w =>
        {
            w.WriteStartObject();
            w.WriteBoolean("success", false);
            w.WriteString("error", error);
            w.WriteEndObject();
        });

    private static WorkerResponse RollbackResult(bool success, bool handled, long? revertedAt, string? reason = null) =>
        WorkerResponse.FromWriter(w =>
        {
            w.WriteStartObject();
            w.WriteBoolean("success", success);
            w.WriteBoolean("handled", handled);
            w.WriteBoolean("reverted", success);
            if (revertedAt.HasValue) w.WriteNumber("revertedAt", revertedAt.Value);
            if (reason is not null) w.WriteString("reason", reason);
            w.WriteEndObject();
        });

    // ── Internal models ──

    private sealed class ChangeSet
    {
        public string RunId { get; set; } = string.Empty;
        public string? SessionId { get; set; }
        public string Status { get; set; } = "open";
        public List<FileChange> Changes { get; } = new();
        public long CreatedAt { get; set; }
        public long UpdatedAt { get; set; }
    }

    private sealed class FileChange
    {
        public string Id { get; set; } = string.Empty;
        public string RunId { get; set; } = string.Empty;
        public string? SessionId { get; set; }
        public string FilePath { get; set; } = string.Empty;
        public string Transport { get; set; } = "local";
        public string Op { get; set; } = "modify";
        public string Status { get; set; } = "open";
        public FileSnapshot Before { get; set; } = new();
        public FileSnapshot After { get; set; } = new();
        public long CreatedAt { get; set; }
        public long? RevertedAt { get; set; }
    }

    private sealed class FileSnapshot
    {
        public bool Exists { get; set; }
        public string? Text { get; set; }
        public string? FullText { get; set; }
        public string? PreviewText { get; set; }
        public string? TailPreviewText { get; set; }
        public bool? TextOmitted { get; set; }
        public string? Hash { get; set; }
        public long Size { get; set; }
        public int? LineCount { get; set; }
    }
}
