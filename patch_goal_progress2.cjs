const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/renderer/src/stores/chat-store/index.ts';
let content = fs.readFileSync(path, 'utf8');

// The sub-agent block with CRLF
const subAgentBlock = [
  "        if (eventType.startsWith('sub_agent_')) {",
  "          const subEvent = adaptSubAgentEvent(event)",
  "          if (subEvent) {",
  "            useAgentStore.getState().handleSubAgentEvent(subEvent, targetSessionId)",
  "          }",
  "          continue",
  "        }"
].join('\r\n');

const goalProgressBlock = [
  "        if (eventType.startsWith('sub_agent_')) {",
  "          const subEvent = adaptSubAgentEvent(event)",
  "          if (subEvent) {",
  "            useAgentStore.getState().handleSubAgentEvent(subEvent, targetSessionId)",
  "          }",
  "          continue",
  "        }",
  "",
  "        // Route goal_progress events to the goal store",
  "        if (eventType === 'goal_progress') {",
  "          const gp = event as { goalId?: string; sessionId?: string; eventType?: string; message?: string; status?: string; currentPlanIndex?: number; planCount?: number; completedPlans?: number; timestamp?: number }",
  "          const gpSessionId = gp.sessionId ?? targetSessionId",
  "          if (gpSessionId && gp.eventType) {",
  "            useGoalStore.getState().applyGoalProgress({",
  "              sessionId: gpSessionId,",
  "              goalId: gp.goalId ?? '',",
  "              eventType: gp.eventType,",
  "              message: gp.message ?? '',",
  "              status: gp.status ?? '',",
  "              currentPlanIndex: gp.currentPlanIndex ?? 0,",
  "              planCount: gp.planCount ?? 0,",
  "              completedPlans: gp.completedPlans ?? 0,",
  "              timestamp: gp.timestamp ?? Date.now()",
  "            })",
  "          }",
  "          continue",
  "        }"
].join('\r\n');

if (content.includes(subAgentBlock)) {
  content = content.replace(subAgentBlock, goalProgressBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done - goal_progress routing added');
} else {
  // Try LF
  const subAgentBlockLF = subAgentBlock.replace(/\r\n/g, '\n');
  if (content.includes(subAgentBlockLF)) {
    content = content.replace(subAgentBlockLF, goalProgressBlock.replace(/\r\n/g, '\n'));
    fs.writeFileSync(path, content, 'utf8');
    console.log('Done (LF) - goal_progress routing added');
  } else {
    console.error('Block not found in either CRLF or LF');
    // Debug: show what's around the sub_agent_ text
    const idx = content.indexOf("eventType.startsWith('sub_agent_')");
    if (idx >= 0) {
      console.log('Found at index:', idx);
      console.log('Context:', JSON.stringify(content.substring(idx - 10, idx + 200)));
    } else {
      console.error('Could not even find sub_agent_ text');
    }
    process.exit(1);
  }
}
