using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Worker.Runtime;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Web search provider implementations: Google, Bing, Baidu, Tavily, Searxng, Exa, Bocha, Zhipu.
/// Extracted from AgentRuntimeWebSearchExecutor for maintainability.
/// </summary>
internal static partial class AgentRuntimeWebSearchExecutor
{
    private static async Task<WebSearchResponse> SearchGoogleAsync(WebSearchRequest request, CancellationToken ct)
    {
        var url = $"https://www.google.com/search?hl=en&num={request.MaxResults}&gbv=1&q={Uri.EscapeDataString(request.Query)}";
        var response = await SendGetAsync(url, new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            ["Accept-Language"] = "en-US,en;q=0.9"
        }, request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Google search error: {response.StatusCode}");
        if (Regex.IsMatch(response.Body, "unusual traffic|detected unusual traffic|sorry/index|To continue, please type", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Google blocked background crawling for this request");

        var results = ExtractGoogleResults(response.Body, request.MaxResults);
        if (results.Count == 0)
            throw new InvalidOperationException("Google returned no parseable search results");
        return new WebSearchResponse(results, request.Query, "google", results.Count);
    }

    private static async Task<WebSearchResponse> SearchBingAsync(WebSearchRequest request, CancellationToken ct)
    {
        var url = $"https://www.bing.com/search?q={Uri.EscapeDataString(request.Query)}&count={request.MaxResults}";
        var response = await SendGetAsync(url, new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            ["Accept-Language"] = "en-US,en;q=0.9"
        }, request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Bing search error: {response.StatusCode}");

        var results = ExtractBingResults(response.Body, request.MaxResults);
        if (results.Count == 0)
            throw new InvalidOperationException("Bing returned no parseable search results");
        return new WebSearchResponse(results, request.Query, "bing", results.Count);
    }

    private static async Task<WebSearchResponse> SearchBaiduAsync(WebSearchRequest request, CancellationToken ct)
    {
        var url = $"https://www.baidu.com/s?wd={Uri.EscapeDataString(request.Query)}&rn={request.MaxResults}";
        var response = await SendGetAsync(url, new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            ["Accept-Language"] = "zh-CN,zh;q=0.9,en;q=0.8"
        }, request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Baidu search error: {response.StatusCode}");
        if (Regex.IsMatch(response.Body, "百度安全验证|网络不给力|请输入验证码|verify", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Baidu blocked background crawling for this request");

        var results = ExtractBaiduResults(response.Body, request.MaxResults);
        if (results.Count == 0)
            throw new InvalidOperationException("Baidu returned no parseable search results");
        return new WebSearchResponse(results, request.Query, "baidu", results.Count);
    }

    private static async Task<WebSearchResponse> SearchTavilyAsync(WebSearchRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ApiKey))
            throw new InvalidOperationException("Tavily API key is required");

        var body = EncodeJsonObject(writer =>
        {
            writer.WriteString("query", request.Query);
            writer.WriteString("api_key", request.ApiKey);
            writer.WriteNumber("max_results", request.MaxResults);
            writer.WriteString("search_mode", request.SearchMode);
        });
        var response = await SendJsonPostAsync("https://api.tavily.com/search", body, null, request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Tavily API error: {response.StatusCode} - {response.Body}");
        return ParseProviderJsonResponse(response.Body, request.Query, "tavily", "content");
    }

    private static async Task<WebSearchResponse> SearchSearxngAsync(WebSearchRequest request, CancellationToken ct)
    {
        var url = $"https://searxng.org/search?q={Uri.EscapeDataString(request.Query)}&format=json&limit={request.MaxResults}";
        var response = await SendGetAsync(url, null, request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Searxng API error: {response.StatusCode} - {response.Body}");
        return ParseProviderJsonResponse(response.Body, request.Query, "searxng", "content");
    }

    private static async Task<WebSearchResponse> SearchExaAsync(WebSearchRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ApiKey))
            throw new InvalidOperationException("Exa API key is required");

        var body = EncodeJsonObject(writer =>
        {
            writer.WriteString("query", request.Query);
            writer.WriteNumber("numResults", request.MaxResults);
            writer.WriteString("searchMode", request.SearchMode);
        });
        var response = await SendJsonPostAsync("https://api.exa.ai/search", body,
            new Dictionary<string, string>(StringComparer.Ordinal) { ["x-api-key"] = request.ApiKey! },
            request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Exa API error: {response.StatusCode} - {response.Body}");
        return ParseProviderJsonResponse(response.Body, request.Query, "exa", "snippet");
    }

    private static async Task<WebSearchResponse> SearchBochaAsync(WebSearchRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ApiKey))
            throw new InvalidOperationException("Bocha API key is required");

        var body = EncodeJsonObject(writer =>
        {
            writer.WriteString("query", request.Query);
            writer.WriteNumber("limit", request.MaxResults);
        });
        var response = await SendJsonPostAsync("https://api.bocha.cn/search", body,
            new Dictionary<string, string>(StringComparer.Ordinal) { ["Authorization"] = $"Bearer {request.ApiKey}" },
            request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Bocha API error: {response.StatusCode} - {response.Body}");
        return ParseProviderJsonResponse(response.Body, request.Query, "bocha", "snippet");
    }

    private static async Task<WebSearchResponse> SearchZhipuAsync(WebSearchRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ApiKey))
            throw new InvalidOperationException("Zhipu API key is required");

        var body = EncodeJsonObject(writer =>
        {
            writer.WriteString("prompt", request.Query);
            writer.WriteNumber("max_results", request.MaxResults);
        });
        var response = await SendJsonPostAsync("https://open.bigmodel.cn/api/paas/v4/tools/search", body,
            new Dictionary<string, string>(StringComparer.Ordinal) { ["Authorization"] = $"Bearer {request.ApiKey}" },
            request.TimeoutMs, ct);
        if (response.StatusCode != 200)
            throw new InvalidOperationException($"Zhipu API error: {response.StatusCode} - {response.Body}");
        return ParseProviderJsonResponse(response.Body, request.Query, "zhipu", "content", fallbackContentProperty: "snippet");
    }

    private static WebSearchResponse SearchExaMcp(WebSearchRequest request)
    {
        return new WebSearchResponse(
            [new WebSearchResult("Exa MCP Search", string.Empty,
                "Exa MCP search requires an MCP server connection. Please configure an MCP server with Exa search capabilities.",
                null, null)],
            request.Query, "exa-mcp", 0);
    }

    // ── HTML result extraction ──

}
