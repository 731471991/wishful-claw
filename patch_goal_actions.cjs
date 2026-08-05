const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/renderer/src/components/goal/goal-session-views.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update setGoalStatus to also call Worker IPC
// Add Worker IPC call after the DB update
const oldSetGoalStatus = `      if (status === 'paused' && result.goal?.status === 'paused') {
        abortSession(sessionId)
      }
    },
    [sessionId, t]
  )`;

const newSetGoalStatus = `      if (status === 'paused' && result.goal?.status === 'paused') {
        abortSession(sessionId)
        // Also notify the Goal orchestrator Worker
        try {
          await invokeMessagePackBinary(GOAL_PAUSE_MSGPACK_CHANNEL, { sessionId, goalId: goal?.goalId })
        } catch { /* orchestrator may not be running */ }
      }
      if (status === 'active' && result.goal?.status === 'active') {
        dispatchNextQueuedMessageForSession(sessionId)
        // Also notify the Goal orchestrator Worker to resume
        try {
          await invokeMessagePackBinary(GOAL_RESUME_MSGPACK_CHANNEL, { sessionId, goalId: goal?.goalId })
        } catch { /* orchestrator may not be running */ }
      }
    },
    [sessionId, t, goal?.goalId]
  )

  const abortGoal = React.useCallback(
    async (): Promise<void> => {
      if (!sessionId || !goal) return
      try {
        await invokeMessagePackBinary(GOAL_ABORT_MSGPACK_CHANNEL, { sessionId, goalId: goal.goalId })
      } catch { /* ignore */ }
      const result = await useGoalStore.getState().updateGoal(sessionId, { status: 'paused' })
      if (!result.success) {
        toast.error(t('goal.toasts.updateFailed'), { description: result.error })
      }
    },
    [sessionId, goal, t]
  )`;

if (content.includes(oldSetGoalStatus)) {
  content = content.replace(oldSetGoalStatus, newSetGoalStatus);
  console.log('setGoalStatus updated');
} else {
  // Try LF
  const oldLF = oldSetGoalStatus.replace(/\r\n/g, '\n');
  if (content.includes(oldLF)) {
    content = content.replace(oldLF, newSetGoalStatus.replace(/\r\n/g, '\n'));
    console.log('setGoalStatus updated (LF)');
  } else {
    console.error('setGoalStatus block not found');
    process.exit(1);
  }
}

// 2. Add abortGoal to the return object
const oldReturn = `  return {
    open,
    objectiveDraft,
    tokenBudgetDraft,
    saving,
    clearing,
    setOpen,
    setObjectiveDraft,
    setTokenBudgetDraft,
    openManager,
    saveGoal,
    clearGoal,
    setGoalStatus
  }`;

const newReturn = `  return {
    open,
    objectiveDraft,
    tokenBudgetDraft,
    saving,
    clearing,
    setOpen,
    setObjectiveDraft,
    setTokenBudgetDraft,
    openManager,
    saveGoal,
    clearGoal,
    setGoalStatus,
    abortGoal
  }`;

if (content.includes(oldReturn)) {
  content = content.replace(oldReturn, newReturn);
  console.log('Return updated');
} else {
  const oldReturnLF = oldReturn.replace(/\r\n/g, '\n');
  if (content.includes(oldReturnLF)) {
    content = content.replace(oldReturnLF, newReturn.replace(/\r\n/g, '\n'));
    console.log('Return updated (LF)');
  } else {
    console.error('Return block not found');
    process.exit(1);
  }
}

// 3. Add abortGoal to the function return type
const oldType = `  setGoalStatus: (status: 'active' | 'paused') => Promise<void>
}: {`;

const newType = `  setGoalStatus: (status: 'active' | 'paused') => Promise<void>
  abortGoal: () => Promise<void>
}: {`;

if (content.includes(oldType)) {
  content = content.replace(oldType, newType);
  console.log('Type updated');
} else {
  const oldTypeLF = oldType.replace(/\r\n/g, '\n');
  if (content.includes(oldTypeLF)) {
    content = content.replace(oldTypeLF, newType.replace(/\r\n/g, '\n'));
    console.log('Type updated (LF)');
  } else {
    console.error('Type block not found');
    process.exit(1);
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
