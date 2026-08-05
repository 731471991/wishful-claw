import pathlib

# 1. Update composer-toolbar to pass collabModeOverride
f = pathlib.Path('src/renderer/src/components/chat/InputArea/composer-toolbar.tsx')
c = f.read_text(encoding='utf-8')

old_props = '  onCollabModeChange?: (mode: CollabMode) => void'
new_props = '  onCollabModeChange?: (mode: CollabMode) => void\n  collabModeOverride?: CollabMode'
c = c.replace(old_props, new_props, 1)

old_destructure = 'draftSessionIdCollab, collabModeDisabled, onCollabModeChange,'
new_destructure = 'draftSessionIdCollab, collabModeDisabled, onCollabModeChange, collabModeOverride,'
c = c.replace(old_destructure, new_destructure, 1)

old_render = '                onModeChange={onCollabModeChange}'
new_render = '                modeOverride={collabModeOverride}\n                onModeChange={onCollabModeChange}'
c = c.replace(old_render, new_render, 1)

f.write_text(c, encoding='utf-8')
print('OK: composer-toolbar updated')

# 2. Update index.tsx
f = pathlib.Path('src/renderer/src/components/chat/InputArea/index.tsx')
c = f.read_text(encoding='utf-8')

# Add pendingCollabMode state
old_state = 'const [, setPendingGoalMode] = React.useState(false)'
new_state = "const [, setPendingGoalMode] = React.useState(false)\n  const [pendingCollabMode, setPendingCollabMode] = React.useState<CollabMode | null>(null)"
assert old_state in c, "state not found"
c = c.replace(old_state, new_state, 1)

# Update isGoalMode
old_goal = "const isGoalMode = collabMode === 'goal'"
new_goal = "const isGoalMode = collabMode === 'goal' || pendingCollabMode === 'goal'"
assert old_goal in c, "isGoalMode not found"
c = c.replace(old_goal, new_goal, 1)

# Add effectiveCollabMode after isGoalMode
old_line = "const isGoalMode = collabMode === 'goal' || pendingCollabMode === 'goal'"
new_line = "const isGoalMode = collabMode === 'goal' || pendingCollabMode === 'goal'\n  const effectiveCollabMode: CollabMode = draftSessionId ? collabMode : (pendingCollabMode ?? 'normal')"
c = c.replace(old_line, new_line, 1)

# Update handleCollabModeChange
old_handler = """  const handleCollabModeChange = React.useCallback((nextMode: CollabMode): void => {
    if (disabled || isStreaming || isOptimizingLocked || pendingImageReads > 0) return
    if (nextMode === 'normal') {
      if (draftSessionId && hasActiveGoal) {
        void useGoalStore.getState().loadGoalForSession(draftSessionId, true)
          .then(() => useGoalStore.getState().updateGoal(draftSessionId, { status: 'paused' }))
      }
      if (draftSessionId) useUIStore.getState().setCollabMode(draftSessionId, 'normal')
    } else {
      if (draftSessionId) useUIStore.getState().setCollabMode(draftSessionId, 'goal')
      requestAnimationFrame(() => focusInputAtEnd())
    }
  }, [disabled, isStreaming, isOptimizingLocked, pendingImageReads, draftSessionId, hasActiveGoal, focusInputAtEnd])"""
new_handler = """  const handleCollabModeChange = React.useCallback((nextMode: CollabMode): void => {
    if (disabled || isStreaming || isOptimizingLocked || pendingImageReads > 0) return
    if (nextMode === 'normal') {
      if (draftSessionId && hasActiveGoal) {
        void useGoalStore.getState().loadGoalForSession(draftSessionId, true)
          .then(() => useGoalStore.getState().updateGoal(draftSessionId, { status: 'paused' }))
      }
      if (draftSessionId) useUIStore.getState().setCollabMode(draftSessionId, 'normal')
      setPendingCollabMode(null)
    } else {
      if (draftSessionId) useUIStore.getState().setCollabMode(draftSessionId, 'goal')
      else setPendingCollabMode('goal')
      requestAnimationFrame(() => focusInputAtEnd())
    }
  }, [disabled, isStreaming, isOptimizingLocked, pendingImageReads, draftSessionId, hasActiveGoal, focusInputAtEnd])"""
assert old_handler in c, "handler not found"
c = c.replace(old_handler, new_handler, 1)

# Pass effectiveCollabMode to ComposerToolbar
old_tb = '            onCollabModeChange={projectScoped ? handleCollabModeChange : undefined}'
new_tb = '            collabModeOverride={effectiveCollabMode}\n            onCollabModeChange={projectScoped ? handleCollabModeChange : undefined}'
assert old_tb in c, "toolbar prop not found"
c = c.replace(old_tb, new_tb, 1)

f.write_text(c, encoding='utf-8')
print('OK: index.tsx updated')
