const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/runtime/WishfulClaw.Agent/AgentRuntimePlanExecutor.cs';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Remove EnterPlanMode goalMode branch
// From "// Goal mode: return autonomous guidance" to the closing "}" before "return EncodeJsonObject"
const block1Start = '        // Goal mode: return autonomous guidance (no user confirmation needed)\n';
const block1End = '        }\n\n        return EncodeJsonObject(writer =>\n        {\n            writer.WriteString("status", status);\n            writer.WriteString("plan_id", planId);\n            writer.WriteString("plan_file_path", planFilePath);\n            writer.WriteString(\n                "message",';

const idx1Start = content.indexOf(block1Start);
if (idx1Start < 0) { console.error('Block 1 start not found'); process.exit(1); }

const idx1End = content.indexOf(block1End, idx1Start);
if (idx1End < 0) { console.error('Block 1 end not found'); process.exit(1); }

// Remove from block1Start to block1End (keep the return statement)
content = content.substring(0, idx1Start) + '        return EncodeJsonObject(writer =>\n        {\n            writer.WriteString("status", status);\n            writer.WriteString("plan_id", planId);\n            writer.WriteString("plan_file_path", planFilePath);\n            writer.WriteString(\n                "message",' + content.substring(idx1End + block1End.length);
console.log('Block 1 removed (EnterPlanMode goalMode)');

// 2. Remove SubmitPlanReview goalMode branch
const block2Start = '        // Goal mode: skip user review, self-confirm\n';
const block2End = '        }\n\n        // Send reverse request to renderer and wait for user review';

const idx2Start = content.indexOf(block2Start);
if (idx2Start < 0) { console.error('Block 2 start not found'); process.exit(1); }

const idx2End = content.indexOf(block2End, idx2Start);
if (idx2End < 0) { console.error('Block 2 end not found'); process.exit(1); }

content = content.substring(0, idx2Start) + '        // Send reverse request to renderer and wait for user review' + content.substring(idx2End + block2End.length);
console.log('Block 2 removed (SubmitPlanReview goalMode)');

// 3. Remove ExitPlanMode goalMode branch
// Replace the goalMode exit status logic with simple cancelled
const block3 = `        // Determine exit status: Goal mode supports "completed"/"failed", default is "cancelled"
        var exitStatus = "cancelled";
        var isGoalExit = JsonHelpers.GetBool(parameters, "goalMode", false);
        if (isGoalExit)
        {
            var resultStatus = JsonHelpers.GetString(parameters, "result")?.Trim();
            if (resultStatus == "completed" || resultStatus == "failed")
                exitStatus = resultStatus;
        }`;

const block3Replacement = `        // Determine exit status (default: cancelled)
        var exitStatus = "cancelled";`;

if (content.includes(block3)) {
  content = content.replace(block3, block3Replacement);
  console.log('Block 3 removed (ExitPlanMode goalMode)');
} else {
  console.error('Block 3 not found');
  // Try to find it
  const idx = content.indexOf('isGoalExit');
  console.log('isGoalExit found at:', idx);
  process.exit(1);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done - all 3 goalMode branches removed');
