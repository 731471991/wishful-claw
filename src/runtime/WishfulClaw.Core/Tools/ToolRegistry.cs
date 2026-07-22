using System;
using System.Collections.Generic;
using System.Text.Json;

namespace WishfulClaw.Core.Tools;

/// <summary>
/// Tool registry — registers tools, provides lookup and listing.
/// </summary>
public sealed class ToolRegistry
{
    private readonly Dictionary<string, IToolExecutor> _tools = new(StringComparer.Ordinal);

    /// <summary>
    /// Register a tool executor.
    /// </summary>
    public void Register(IToolExecutor executor)
    {
        _tools[executor.Name] = executor;
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
    /// Get all registered tool definitions (for sending to LLM provider).
    /// </summary>
    public IReadOnlyList<ToolDefinition> GetToolDefinitions()
    {
        var list = new List<ToolDefinition>(_tools.Count);
        foreach (var executor in _tools.Values)
        {
            list.Add(new ToolDefinition(executor.Name, executor.Description, executor.InputSchema));
        }
        return list;
    }

    /// <summary>
    /// Get all registered tool names.
    /// </summary>
    public IReadOnlyCollection<string> GetToolNames()
    {
        return _tools.Keys;
    }
}
