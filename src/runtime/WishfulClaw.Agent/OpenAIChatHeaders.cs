using System.Net.Http;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// OpenAI-compatible chat provider — HTTP header configuration.
/// </summary>
internal static partial class OpenAIChatProvider
{
    private static void ApplyHeaders(HttpRequestMessage request, JsonElement provider, string apiKey)
    {
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        ApiUserAgent.Apply(request, provider);

        if (JsonHelpers.GetString(provider, "organization") is { Length: > 0 } organization)
        {
            request.Headers.TryAddWithoutValidation("OpenAI-Organization", organization);
        }
        if (JsonHelpers.GetString(provider, "project") is { Length: > 0 } project)
        {
            request.Headers.TryAddWithoutValidation("OpenAI-Project", project);
        }

        ProviderRequestOverrides.ApplyHttpHeaderOverrides(request, provider);
        ApiUserAgent.Ensure(request, provider);
    }

    private static IReadOnlyDictionary<string, string> BuildDebugHeaders(JsonElement provider)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Content-Type"] = "application/json",
            ["Authorization"] = "Bearer ***"
        };
        ApiUserAgent.ApplyDebug(headers, provider);
        ProviderRequestOverrides.ApplyDebugHeaderOverrides(headers, provider);
        ApiUserAgent.EnsureDebug(headers, provider);
        return headers;
    }
}
