const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Replace "var goalParameters = AddGoalModeToParameters(parameters);" with just using parameters directly
content = content.replace(
    '        var goalParameters = AddGoalModeToParameters(parameters);\n\n        try\n        {\n            var result = await SubAgentExecutor.ExecuteAsync(\n                input, goalParameters, parentState, context, toolCallId);',
    '        try\n        {\n            var result = await SubAgentExecutor.ExecuteAsync(\n                input, parameters, parentState, context, toolCallId);'
);
console.log('Call site updated');

// 2. Remove the AddGoalModeToParameters method entirely
const methodBlock = `    /// <summary>\n    /// Add goalMode=true to parameters as a behavioral hint.\n    /// </summary>\n    private static JsonElement AddGoalModeToParameters(JsonElement parameters)\n    {\n        var json = parameters.GetRawText();\n        if (json.StartsWith("{"))\n        {\n            json = "{\\"goalMode\\":true," + json.Substring(1);\n        }\n        using var doc = JsonDocument.Parse(json);\n        return doc.RootElement.Clone();\n    }\n`;

if (content.includes(methodBlock)) {
  content = content.replace(methodBlock, '');
  console.log('Method removed');
} else {
  console.error('Method block not found');
  // Debug
  const idx = content.indexOf('AddGoalModeToParameters');
  console.log('Found at:', idx);
  if (idx >= 0) console.log('Context:', JSON.stringify(content.substring(idx - 50, idx + 300)));
  process.exit(1);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
