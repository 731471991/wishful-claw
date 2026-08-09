using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Memory module result types for AOT-safe serialization.
/// </summary>
public sealed record MemoryReadResult(string Content);
public sealed record MemorySearchResponse(List<MemorySearchResult> Hits);
public sealed record MemoryMutationResult(bool Ok, long? Id = null, string? Error = null);
