const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/renderer/src/components/goal/goal-session-views.tsx';
let content = fs.readFileSync(path, 'utf8');

// Helper: normalize all line endings to \n, do replacement, restore \n
content = content.replace(/\r\n/g, '\n');

// 1. Update deps array: [sessionId, t] -> [sessionId, t, goal?.goalId]
content = content.replace(
  '    [sessionId, t]\n  )\n\n  const clearGoal',
  '    [sessionId, t, goal?.goalId]\n  )\n\n  const abortGoal = React.useCallback(\n    async (): Promise<void> => {\n      if (!sessionId || !goal) return\n      try {\n        await invokeMessagePackBinary(GOAL_ABORT_MSGPACK_CHANNEL, { sessionId, goalId: goal.goalId })\n      } catch { /* ignore */ }\n      await useGoalStore.getState().updateGoal(sessionId, { status: \'paused\' })\n    },\n    [sessionId, goal]\n  )\n\n  const clearGoal'
);

// 2. Add abortGoal to return type
content = content.replace(
  "  setGoalStatus: (status: 'active' | 'paused') => Promise<void>\n}: {",
  "  setGoalStatus: (status: 'active' | 'paused') => Promise<void>\n  abortGoal: () => Promise<void>\n}: {"
);

// 3. Add abortGoal to return object
content = content.replace(
  '    setGoalStatus\n  }',
  '    setGoalStatus,\n    abortGoal\n  }'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done - all 3 changes applied');
