using System.Text.Json;

namespace WishfulClaw.Contracts;

/// <summary>
/// Result types for anonymous-type replacement (AOT-safe).
/// These records replace inline `new { ok = true, ... }` anonymous types
/// that cannot be used with JsonSerializer source generation.
/// </summary>

// ── Generic ok/error results ──
public sealed record SimpleOkResult(bool Ok, string? Error = null);

// ── Generic success/error results ──
public sealed record SimpleSuccessResult(bool Success, string? Error = null);

// ── Provider test results ──
public sealed record ProviderTestResult(
    bool Ok,
    int? StatusCode = null,
    string? Error = null,
    List<string>? Models = null,
    int? StatusCode2 = null);

/// <summary>
/// Single model entry returned by provider/fetch-models.
/// </summary>
public sealed record ProviderModelInfo(
    string Id,
    string Name,
    bool Enabled);

/// <summary>
/// Provider test result with model list.
/// </summary>
public sealed record ProviderTestModelsResult(
    bool Ok,
    List<ProviderModelInfo>? Models = null);

// ── Goal module results ──
public sealed record GoalSimpleResult(bool Success);
public sealed record GoalClearResult(bool Success, bool Cleared);
public sealed record GoalStatusResponse(
    bool Active,
    string Status = "unknown",
    string? GoalId = null,
    int CurrentPlanIndex = -1,
    int PlanCount = 0,
    int CompletedPlans = 0);
