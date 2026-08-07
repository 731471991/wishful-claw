using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Agent;

/// <summary>
/// Project management tools executor — list_projects / get_project_details / create_session / send_session_message.
/// The first three tools execute directly in Worker (DB operations).
/// send_session_message uses a reverse-request to the renderer, which dispatches it via normal sendMessage.
/// </summary>
public static class AgentRuntimeProjectExecutor
{
    private static readonly HashSet<string> ProjectToolNames = new(StringComparer.Ordinal)
    {
        "list_projects", "get_project_details", "create_session", "send_session_message"
    };

    public static bool IsProjectTool(string toolName)
    {
        return ProjectToolNames.Contains(toolName);
    }

    public static async Task<string> ExecuteAsync(
        AgentRuntimeNativeToolCall call,
        JsonElement parameters,
        IWorkerRequestContext context,
        CancellationToken cancellationToken)
    {
        return call.Name switch
        {
            "list_projects" => await ListProjectsAsync(call.Input, parameters, cancellationToken),
            "get_project_details" => await GetProjectDetailsAsync(call.Input, parameters, cancellationToken),
            "create_session" => await CreateSessionAsync(call.Input, parameters, cancellationToken),
            "send_session_message" => await SendSessionMessageAsync(call.Input, parameters, context, cancellationToken),
            _ => EncodeError($"Project tool not registered: {call.Name}")
        };
    }

    // ── list_projects ──

    private static Task<string> ListProjectsAsync(
        JsonElement input, JsonElement parameters, CancellationToken cancellationToken)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            var filter = JsonHelpers.GetString(input, "filter")?.Trim() ?? string.Empty;

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var query = db.Queryable<ProjectEntity>()
                .OrderBy("pinned DESC")
                .OrderBy("updated_at DESC");

            if (filter.Length > 0)
            {
                query = query.Where(p => p.Name.Contains(filter));
            }

            var entities = query.ToList();

            var rows = entities.Select(e =>
            {
                var sessionCount = db.Queryable<SessionEntity>()
                    .Where(s => s.ProjectId == e.Id)
                    .Count();

                var activeSessionCount = db.Queryable<SessionEntity>()
                    .Where(s => s.ProjectId == e.Id && s.UpdatedAt > (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 3600000))
                    .Count();

                return new
                {
                    id = e.Id,
                    name = e.Name,
                    workingFolder = e.WorkingFolder,
                    sessionCount,
                    activeSessionCount
                };
            }).ToList();

            var result = JsonSerializer.Serialize(new
            {
                projects = rows,
                total = rows.Count
            });

            return Task.FromResult(result);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            return Task.FromResult(EncodeError($"Failed to list projects: {ex.Message}"));
        }
    }

    // ── get_project_details ──

    private static async Task<string> GetProjectDetailsAsync(
        JsonElement input, JsonElement parameters, CancellationToken cancellationToken)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            var projectId = RequireString(input, "projectId");

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Find project
            var project = db.Queryable<ProjectEntity>().First(p => p.Id == projectId);
            if (project is null)
            {
                return EncodeError($"Project not found: {projectId}");
            }

            // Get sessions for this project (last 20)
            var sessions = db.Queryable<SessionEntity>()
                .Where(s => s.ProjectId == projectId)
                .OrderBy("updated_at DESC")
                .Take(20)
                .ToList();

            var sessionRows = sessions.Select(s => new
            {
                id = s.Id,
                title = s.Title,
                mode = s.Mode,
                messageCount = s.MessageCount,
                createdAt = s.CreatedAt,
                updatedAt = s.UpdatedAt
            }).ToList();

            // Check project-status.md: exists, stale, and provide update template
            string? taskStatus = null;
            bool statusFileNeedsUpdate = false;
            long statusFileAge = 0;

            if (!string.IsNullOrEmpty(project.WorkingFolder))
            {
                var statusFilePath = Path.Combine(project.WorkingFolder, ".wishful-claw", "project-status.md");
                if (File.Exists(statusFilePath))
                {
                    taskStatus = File.ReadAllText(statusFilePath);
                    var lastWrite = File.GetLastWriteTimeUtc(statusFilePath);
                    statusFileAge = (long)(DateTime.UtcNow - lastWrite).TotalMilliseconds;
                    // Stale if older than 1 hour
                    if (statusFileAge > 3600000)
                    {
                        statusFileNeedsUpdate = true;
                    }
                }
                else
                {
                    statusFileNeedsUpdate = true;
                }
            }

            // Fixed template message for Agent to send via send_session_message
            var statusUpdateTemplate = statusFileNeedsUpdate
                ? GenerateStatusUpdateTemplate(project.Name, project.WorkingFolder ?? "")
                : "";

            // Find the most recent active session (updated within last hour) for convenience
            var activeSessionId = sessions
                .Where(s => s.UpdatedAt > (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 3600000))
                .OrderByDescending(s => s.UpdatedAt)
                .Select(s => s.Id)
                .FirstOrDefault() ?? sessions.FirstOrDefault()?.Id;

            var result = JsonSerializer.Serialize(new
            {
                id = project.Id,
                name = project.Name,
                workingFolder = project.WorkingFolder,
                sessions = sessionRows,
                taskStatus = taskStatus ?? "",
                hasTaskStatus = taskStatus is not null,
                statusFileNeedsUpdate,
                statusUpdateTemplate,
                suggestedSessionId = activeSessionId ?? ""
            });

            return result;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            return EncodeError($"Failed to get project details: {ex.Message}");
        }
    }

    // ── create_session ──

    private static Task<string> CreateSessionAsync(
        JsonElement input, JsonElement parameters, CancellationToken cancellationToken)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            var projectId = RequireString(input, "projectId");
            var sessionName = JsonHelpers.GetString(input, "sessionName")?.Trim();
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Find project to get working folder
            var project = db.Queryable<ProjectEntity>().First(p => p.Id == projectId);
            if (project is null)
            {
                return Task.FromResult(EncodeError($"Project not found: {projectId}"));
            }

            var sessionId = $"wc_{Guid.NewGuid():N}";
            var title = sessionName ?? $"New Task - {DateTime.UtcNow:yyyy-MM-dd HH:mm}";

            var entity = new SessionEntity
            {
                Id = sessionId,
                Title = title,
                Mode = "chat",
                CreatedAt = now,
                UpdatedAt = now,
                MessageCount = 0,
                ProjectId = projectId,
                WorkingFolder = project.WorkingFolder,
                SshConnectionId = project.SshConnectionId,
                Pinned = 0
            };

            db.Insertable(entity).ExecuteCommand();

            var result = JsonSerializer.Serialize(new
            {
                sessionId,
                title,
                projectId,
                createdAt = now
            });

            return Task.FromResult(result);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            return Task.FromResult(EncodeError($"Failed to create session: {ex.Message}"));
        }
    }

    // ── send_session_message ──

    private static async Task<string> SendSessionMessageAsync(
        JsonElement input, JsonElement parameters, IWorkerRequestContext context, CancellationToken cancellationToken)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            var sessionId = RequireString(input, "sessionId");
            var content = RequireString(input, "content");
            var workingFolder = JsonHelpers.GetString(input, "workingFolder")?.Trim();
            var projectId = JsonHelpers.GetString(input, "projectId")?.Trim();

            // Build reverse request params
            var reverseParams = JsonSerializer.SerializeToElement(new
            {
                sessionId,
                content,
                workingFolder = workingFolder ?? string.Empty,
                projectId = projectId ?? string.Empty
            });

            // Emit reverse request to renderer
            var result = await AgentRuntimeReverseRequests.RequestAsync(
                context, "project/send-session-message", reverseParams, cancellationToken);

            var output = result.ValueKind == JsonValueKind.String
                ? result.GetString() ?? string.Empty
                : result.ToString();

            return string.IsNullOrEmpty(output) ? "Message sent successfully." : output;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            return EncodeError($"Failed to send session message: {ex.Message}");
        }
    }

    // ── Helpers ──

    private static string RequireString(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException($"Expected object, got {element.ValueKind}");

        if (!element.TryGetProperty(name, out var prop) || prop.ValueKind != JsonValueKind.String)
            throw new InvalidOperationException($"Missing or invalid required field: {name}");

        var value = prop.GetString()?.Trim();
        if (string.IsNullOrEmpty(value))
            throw new InvalidOperationException($"Required field '{name}' is empty");

        return value;
    }

    private static string EncodeError(string message)
    {
        return JsonSerializer.Serialize(new { error = message });
    }

    /// <summary>
    /// Generate a fixed template message for the Agent to send to a project session,
    /// instructing it to organize and write a clean project-status.md summary.
    /// </summary>
    private static string GenerateStatusUpdateTemplate(string projectName, string workingFolder)
    {
        return $"Please organize the current task status for project **{projectName}** " +
            $"and write a clean summary to `.wishful-claw/project-status.md` in the working directory.\n\n" +
            "The status file should include:\n" +
            "- **Active tasks**: what's currently being worked on\n" +
            "- **Recent changes**: what was done recently\n" +
            "- **Next steps**: what's planned next\n" +
            "- **Blockers**: any issues that need attention\n\n" +
            "Please review the current conversation history, plans, and goals to produce " +
            "an accurate and up-to-date summary. Write the file in Markdown format " +
            $"at `{workingFolder}/.wishful-claw/project-status.md`.";
    }
}