import pathlib

# 1. PromptBuilder.cs - Add Goal context segment
f = pathlib.Path('src/runtime/WishfulClaw.Persona/PromptBuilder.cs')
c = f.read_text(encoding='utf-8')

# Add BuildGoalContext call before Tool Capability
marker = 'parts.Add(BuildToolCapability(parameters));'
idx = c.index(marker)
insertion = '''var goalObjective = JsonHelpers.GetString(parameters, "goalObjective");
        if (!string.IsNullOrWhiteSpace(goalObjective))
        {
            parts.Add(BuildGoalContext(goalObjective!));
        }
        '''
c = c[:idx] + insertion + c[idx:]

# Add BuildGoalContext method at the end of the class
# Find the last closing brace of the class
last_brace = c.rfind('}')
# Insert before the last closing brace
method = '''
    // ── Goal Context ──
    private static string BuildGoalContext(string goalObjective)
    {
        return $@"
<goal_context>
You are operating in **Goal Mode**. The user has set the following objective for you to pursue autonomously:

Objective: {goalObjective}

Instructions:
- Use the `create_goal` tool to record this objective as the active goal for this session.
- Break the objective into steps and work through them systematically.
- Use `update_goal` to mark the goal as `complete` when the objective is achieved, or `blocked` if you cannot make progress.
- Work autonomously — do not ask the user for confirmation between steps unless genuinely blocked.
</goal_context>";
    }
'''
c = c[:last_brace] + method + c[last_brace:]

f.write_text(c, encoding='utf-8')
print('OK: PromptBuilder updated')

# 2. AgentLoop.cs - Add goalObjective to cache key
f = pathlib.Path('src/runtime/WishfulClaw.Agent/AgentLoop.cs')
c = f.read_text(encoding='utf-8')

old_cache = 'var cacheKey = SystemPromptCache.ComputeKey(personaId, workingFolder, language, userRules, sshConnectionId, projectId);'
new_cache = 'var goalObjective = JsonHelpers.GetString(parameters, "goalObjective");\n            var cacheKey = SystemPromptCache.ComputeKey(personaId, workingFolder, language, userRules, sshConnectionId, projectId, goalObjective);'
c = c.replace(old_cache, new_cache, 1)

f.write_text(c, encoding='utf-8')
print('OK: AgentLoop cache key updated')

# 3. SystemPromptCache.cs - Add goalObjective parameter
f = pathlib.Path('src/runtime/WishfulClaw.Agent/SystemPromptCache.cs')
c = f.read_text(encoding='utf-8')

# Find ComputeKey method and add goalObjective parameter
old_sig = 'public static string ComputeKey(string? personaId, string? workingFolder, string? language, string? userRules, string? sshConnectionId, string? projectId)'
new_sig = 'public static string ComputeKey(string? personaId, string? workingFolder, string? language, string? userRules, string? sshConnectionId, string? projectId, string? goalObjective = null)'
c = c.replace(old_sig, new_sig, 1)

# Add goalObjective to the key string
old_key = 'projectId ?? ""'
new_key = 'projectId ?? "",\n            goalObjective ?? ""'
c = c.replace(old_key, new_key, 1)

f.write_text(c, encoding='utf-8')
print('OK: SystemPromptCache updated')
