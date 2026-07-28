using System;
using System.Collections.Generic;
using System.Text.Json;

namespace WishfulClaw.Core.Tools;

/// <summary>
/// Tool registry — registers tools, provides lookup and listing.
/// Incorporates schema canonicalization and stable ordering for prefix-cache friendliness.
/// </summary>
public sealed class ToolRegistry
{
    private readonly Dictionary<string, IToolExecutor> _tools = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> _toolCategories = new(StringComparer.Ordinal);

    // Current category context — set by PushCategory when a Provider registers tools.
    private string? _currentCategory;

    // Cached canonical definitions — computed once after all tools are registered.
    private List<ToolDefinition>? _cachedDefinitions;

    /// <summary>
    /// Set the current category context. All subsequent Register() calls will
    /// associate the tool with this category until PopCategory is called.
    /// Used by ToolProviderDiscovery to automatically tag tools with their provider's category.
    /// </summary>
    public void PushCategory(string category)
    {
        _currentCategory = category;
    }

    /// <summary>
    /// Clear the current category context.
    /// </summary>
    public void PopCategory()
    {
        _currentCategory = null;
    }

    /// <summary>
    /// Register a tool executor.
    /// </summary>
    public void Register(IToolExecutor executor, string? category = null)
    {
        _tools[executor.Name] = executor;
        var cat = category ?? _currentCategory;
        if (cat != null)
            _toolCategories[executor.Name] = cat;
        _cachedDefinitions = null; // Invalidate cache
    }

    /// <summary>
    /// Try to get a tool executor by name.
    /// </summary>
    public bool TryGetExecutor(string name, out IToolExecutor? executor)
    {
        return _tools.TryGetValue(name, out executor);
    }

    /// <summary>
    /// Check if a tool is registered.
    /// </summary>
    public bool IsRegistered(string name)
    {
        return _tools.ContainsKey(name);
    }

    /// <summary>
    /// Get all registered tool names.
    /// </summary>
    public IReadOnlyCollection<string> GetToolNames()
    {
        return _tools.Keys;
    }

    /// <summary>
    /// Get the category for a tool, or null if not categorized.
    /// </summary>
    public string? GetCategory(string toolName)
    {
        return _toolCategories.TryGetValue(toolName, out var cat) ? cat : null;
    }

    /// <summary>
    /// Get all registered tool definitions (for sending to LLM provider).
    /// Definitions are canonicalized once and cached. The returned list is sorted
    /// alphabetically by tool name to ensure stable prefix across requests,
    /// maximizing LLM provider prefix-cache hit rates.
    /// </summary>
    public IReadOnlyList<ToolDefinition> GetToolDefinitions()
    {
        if (_cachedDefinitions != null)
            return _cachedDefinitions;

        var list = new List<ToolDefinition>(_tools.Count);
        foreach (var executor in _tools.Values)
        {
            ToolDefinition def;
            // Read InputSchema once — the property may re-parse on every access,
            // so caching avoids double-throw if the schema JSON is malformed.
            JsonElement rawSchema;
            try
            {
                rawSchema = executor.InputSchema;
            }
            catch (Exception ex)
            {
                System.Console.Error.WriteLine(
                    $"[ToolRegistry] InputSchema parse failed for tool '{executor.Name}': {ex.Message}");
                // Skip this tool entirely — a malformed schema would break the entire tool/list response.
                continue;
            }
            try
            {
                var canonSchema = CanonicalizeSchema(rawSchema);
                def = new ToolDefinition(executor.Name, executor.Description, canonSchema);
            }
            catch (Exception ex)
            {
                System.Console.Error.WriteLine(
                    $"[ToolRegistry] CanonicalizeSchema failed for tool '{executor.Name}': {ex.Message}");
                // Fallback: use the raw schema without canonicalization
                def = new ToolDefinition(executor.Name, executor.Description, rawSchema);
            }
            list.Add(def);
        }

        // Sort by name for stable ordering
        list.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.Ordinal));

        _cachedDefinitions = list;
        return list;
    }

    /// <summary>
    /// Get tool definitions filtered by a predicate (for preset-based filtering).
    /// The underlying definitions are still canonicalized and sorted.
    /// </summary>
    public IReadOnlyList<ToolDefinition> GetToolDefinitions(Predicate<string> toolNameFilter)
    {
        var all = GetToolDefinitions();
        var filtered = new List<ToolDefinition>();
        foreach (var def in all)
        {
            if (toolNameFilter(def.Name))
                filtered.Add(def);
        }
        return filtered;
    }

    /// <summary>
    /// Get tool definitions filtered by a ToolPreset.
    /// Tools are included/excluded based on their category and name.
    /// </summary>
    public IReadOnlyList<ToolDefinition> GetToolDefinitions(ToolPreset preset)
    {
        var all = GetToolDefinitions();
        var filtered = new List<ToolDefinition>();
        foreach (var def in all)
        {
            var category = _toolCategories.TryGetValue(def.Name, out var cat) ? cat : null;
            if (preset.Includes(def.Name, category))
                filtered.Add(def);
        }
        return filtered;
    }

    /// <summary>
    /// Canonicalize a JSON schema into a stable byte representation:
    /// recursively sort object properties alphabetically and sort required arrays.
    /// This maximizes prefix-cache hit rates across LLM requests.
    /// </summary>
    private static JsonElement CanonicalizeSchema(JsonElement schema)
    {
        var canonical = CanonicalizeElement(schema);
        var json = JsonSerializer.Serialize(canonical);
        return JsonDocument.Parse(json).RootElement.Clone();
    }

    private static object? CanonicalizeElement(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                var dict = new SortedDictionary<string, object?>(StringComparer.Ordinal);
                foreach (var prop in element.EnumerateObject())
                {
                    // Special handling for "required" arrays — sort them
                    if (prop.NameEquals("required") && prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        var items = new List<string>();
                        foreach (var item in prop.Value.EnumerateArray())
                            items.Add(item.GetString() ?? "");
                        items.Sort(StringComparer.Ordinal);
                        dict["required"] = items;
                    }
                    else
                    {
                        dict[prop.Name] = CanonicalizeElement(prop.Value);
                    }
                }
                return dict;

            case JsonValueKind.Array:
                var arr = new List<object?>();
                foreach (var item in element.EnumerateArray())
                    arr.Add(CanonicalizeElement(item));
                return arr;

            case JsonValueKind.String:
                return element.GetString();

            case JsonValueKind.Number:
                if (element.TryGetInt64(out var intVal))
                    return intVal;
                if (element.TryGetDouble(out var dblVal))
                    return dblVal;
                return element.GetRawText();

            case JsonValueKind.True:
                return true;

            case JsonValueKind.False:
                return false;

            case JsonValueKind.Null:
            default:
                return null;
        }
    }
}
