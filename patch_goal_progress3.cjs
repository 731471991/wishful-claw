const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/renderer/src/stores/chat-store/index.ts';
let content = fs.readFileSync(path, 'utf8');

const marker = "eventType.startsWith('sub_agent_')";
const idx = content.indexOf(marker);
if (idx < 0) { console.error('marker not found'); process.exit(1); }

const afterMarker = content.substring(idx);
const continueIdx = afterMarker.indexOf('continue');
if (continueIdx < 0) { console.error('continue not found'); process.exit(1); }
const closeIdx = afterMarker.indexOf('}', continueIdx);
if (closeIdx < 0) { console.error('closing brace not found'); process.exit(1); }

const insertPos = idx + closeIdx + 1;

const insertion = [
  '',
  '',
  '        // Route goal_progress events to the goal store',
  '        if (eventType === \'goal_progress\') {',
  '          const gp = event as { goalId?: string; sessionId?: string; eventType?: string; message?: string; status?: string; currentPlanIndex?: number; planCount?: number; completedPlans?: number; timestamp?: number }',
  '          const gpSessionId = gp.sessionId ?? targetSessionId',
  '          if (gpSessionId && gp.eventType) {',
  '            useGoalStore.getState().applyGoalProgress({',
  '              sessionId: gpSessionId,',
  '              goalId: gp.goalId ?? \'\',',
  '              eventType: gp.eventType,',
  '              message: gp.message ?? \'\',',
  '              status: gp.status ?? \'\',',
  '              currentPlanIndex: gp.currentPlanIndex ?? 0,',
  '              planCount: gp.planCount ?? 0,',
  '              completedPlans: gp.completedPlans ?? 0,',
  '              timestamp: gp.timestamp ?? Date.now()',
  '            })',
  '          }',
  '          continue',
  '        }'
].join('\r\n');

content = content.substring(0, insertPos) + insertion + content.substring(insertPos);
fs.writeFileSync(path, content, 'utf8');
console.log('Done - goal_progress routing inserted at pos', insertPos);
