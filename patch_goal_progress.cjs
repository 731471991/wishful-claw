const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/renderer/src/stores/chat-store/index.ts';
let content = fs.readFileSync(path, 'utf8');

// Step 1: Add useGoalStore to the import
const oldImport = "import { installGoalSyncListener } from '@renderer/stores/goal-store'";
const newImport = "import { installGoalSyncListener, useGoalStore } from '@renderer/stores/goal-store'";
if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log('Import updated');
} else {
  console.error('Import not found');
  process.exit(1);
}

// Step 2: Add goal_progress event routing after sub_agent_ routing block
// Find the sub_agent continue statement and add goal_progress handler after it
const subAgentBlock = `        if (eventType.startsWith('sub_agent_')) {
          const subEvent = adaptSubAgentEvent(event)
          if (subEvent) {
            useAgentStore.getState().handleSubAgentEvent(subEvent, targetSessionId)
          }
          continue
        }`;

const goalProgressBlock = `        if (eventType.startsWith('sub_agent_')) {
          const subEvent = adaptSubAgentEvent(event)
          if (subEvent) {
            useAgentStore.getState().handleSubAgentEvent(subEvent, targetSessionId)
          }
          continue
        }

        // Route goal_progress events to the goal store
        if (eventType === 'goal_progress') {
          const gp = event as { goalId?: string; sessionId?: string; eventType?: string; message?: string; status?: string; currentPlanIndex?: number; planCount?: number; completedPlans?: number; timestamp?: number }
          const gpSessionId = gp.sessionId ?? targetSessionId
          if (gpSessionId && gp.eventType) {
            useGoalStore.getState().applyGoalProgress({
              sessionId: gpSessionId,
              goalId: gp.goalId ?? '',
              eventType: gp.eventType,
              message: gp.message ?? '',
              status: gp.status ?? '',
              currentPlanIndex: gp.currentPlanIndex ?? 0,
              planCount: gp.planCount ?? 0,
              completedPlans: gp.completedPlans ?? 0,
              timestamp: gp.timestamp ?? Date.now()
            })
          }
          continue
        }`;

if (content.includes(subAgentBlock)) {
  content = content.replace(subAgentBlock, goalProgressBlock);
  console.log('goal_progress routing added');
} else {
  console.error('Sub-agent block not found');
  process.exit(1);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
