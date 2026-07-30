using System.Net;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// Exception thrown by providers when an HTTP request fails.
/// Carries status code and Retry-After header for the retry policy.
/// Ported from OpenCowork's AgentRuntimeProviderRetryPolicy.
/// </summary>
public sealed class ProviderHttpException : InvalidOperationException
{
    public ProviderHttpException(
        string providerName,
        HttpStatusCode statusCode,
        string responseBody,
        TimeSpan? retryAfter)
        : base($"{providerName} request failed HTTP {(int)statusCode}: {responseBody}")
    {
        StatusCode = (int)statusCode;
        RetryAfter = retryAfter;
    }

    public int StatusCode { get; }

    public TimeSpan? RetryAfter { get; }

    public static async Task<ProviderHttpException> CreateAsync(
        string providerName,
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        return new ProviderHttpException(
            providerName,
            response.StatusCode,
            responseBody,
            response.Headers.RetryAfter?.Delta);
    }
}

/// <summary>
/// Retry policy for transient AI provider failures (429, 5xx).
/// Implements exponential backoff with jitter and Retry-After header support.
/// Design aligned with Reasonix's backoffDelay: exponential + jitter to avoid
/// thundering-herd cascading 429s that destroy prefix cache locality.
/// </summary>
public static class ProviderRetryPolicy
{
    private const int MaxRetryAttempts = 10;
    private const int BaseDelayMs = 500;
    private const int MaxBackoffMs = 15_000;
    private const int MaxRetryAfterMs = 60_000;
    private const int JitterMs = 250;

    private static readonly Random JitterRng = new();

    /// <summary>
    /// Wraps a provider turn execution with automatic retry on 429/5xx.
    /// Emits request_retry stream events so the UI can show retry status.
    /// </summary>
    public static async Task<AgentRuntimeProviderTurnResult> ExecuteAsync(
        Func<Task<AgentRuntimeProviderTurnResult>> execute,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        for (var retryAttempt = 0; ; retryAttempt++)
        {
            try
            {
                return await execute();
            }
            catch (ProviderHttpException ex) when (
                IsRetryableStatus(ex.StatusCode) &&
                retryAttempt < MaxRetryAttempts &&
                !state.IsCancellationRequested)
            {
                var delayMs = ComputeDelayMs(retryAttempt + 1, ex.RetryAfter);
                var attempt = retryAttempt + 1;
                WorkerLog.Warn(
                    $"provider request HTTP {ex.StatusCode}; retrying in {delayMs}ms " +
                    $"attempt={attempt}/{MaxRetryAttempts}");
                await AgentRuntimeTools.EmitAsync(
                    state,
                    context,
                    new AgentRuntimeStreamEvent(
                        "request_retry",
                        Reason: $"HTTP {ex.StatusCode}",
                        Attempt: attempt,
                        MaxAttempts: MaxRetryAttempts,
                        DelayMs: delayMs,
                        StatusCode: ex.StatusCode));
                await Task.Delay(delayMs, state.CancellationToken);
            }
        }
    }

    private static bool IsRetryableStatus(int statusCode)
    {
        return statusCode == 429 || statusCode >= 500;
    }

    /// <summary>
    /// Exponential backoff with jitter, honoring Retry-After.
    /// Attempt 1: 500ms + jitter(0-250ms) = 500-750ms
    /// Attempt 2: 1000ms + jitter = 1000-1250ms
    /// Attempt 3: 2000ms + jitter = 2000-2250ms
    /// ...capped at MaxBackoffMs (15s).
    /// If Retry-After is provided, it takes precedence (capped at MaxRetryAfterMs).
    /// </summary>
    private static int ComputeDelayMs(int attempt, TimeSpan? retryAfter)
    {
        // Honor Retry-After header if present
        if (retryAfter is { } ra)
        {
            var raMs = (int)Math.Clamp(ra.TotalMilliseconds, 0, MaxRetryAfterMs);
            if (raMs > 0) return Math.Min(raMs, MaxBackoffMs);
        }

        // Exponential backoff: 500ms * 2^(attempt-1)
        var exponentialMs = BaseDelayMs * (1 << Math.Min(attempt - 1, 20));
        var cappedMs = Math.Min(exponentialMs, MaxBackoffMs);

        // Add jitter to avoid thundering-herd cascading 429s
        var jitter = JitterRng.Next(0, JitterMs);
        return cappedMs + jitter;
    }
}
