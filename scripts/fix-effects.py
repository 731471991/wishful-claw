import pathlib

f = pathlib.Path('src/renderer/src/components/chat/InputArea/use-input-area-effects.ts')
c = f.read_text(encoding='utf-8')

# 1. Add CollabMode import
old_line = "import { useUIStore } from '@renderer/stores/ui-store'"
new_line = "import { useUIStore } from '@renderer/stores/ui-store'\nimport { type CollabMode } from '../CollabModeSwitcher'"
c = c.replace(old_line, new_line, 1)

# 2. Add to interface
old_iface = "  setPendingGoalMode: React.Dispatch<React.SetStateAction<boolean>>"
new_iface = "  setPendingGoalMode: React.Dispatch<React.SetStateAction<boolean>>\n  pendingCollabMode: CollabMode | null\n  setPendingCollabMode: React.Dispatch<React.SetStateAction<CollabMode | null>>"
c = c.replace(old_iface, new_iface, 1)

# 3. Add to destructuring
old_dest = "setPendingPlanMode, setPendingGoalMode, setAutoAcceptCountdown, setIsWorkspaceAgentsMissing,"
new_dest = "setPendingPlanMode, setPendingGoalMode, pendingCollabMode, setPendingCollabMode, setAutoAcceptCountdown, setIsWorkspaceAgentsMissing,"
c = c.replace(old_dest, new_dest, 1)

# 4. Add effect to apply pending collab mode when session is created
old_effect = "  React.useEffect(() => {\n    if (draftSessionId) setPendingPlanMode(false)\n    setPendingGoalMode(false)\n  }, [draftSessionId, setPendingPlanMode, setPendingGoalMode])"
new_effect = "  React.useEffect(() => {\n    if (draftSessionId) setPendingPlanMode(false)\n    setPendingGoalMode(false)\n  }, [draftSessionId, setPendingPlanMode, setPendingGoalMode])\n\n  // Apply pending collab mode when session is created\n  React.useEffect(() => {\n    if (draftSessionId && pendingCollabMode) {\n      useUIStore.getState().setCollabMode(draftSessionId, pendingCollabMode)\n    }\n    setPendingCollabMode(null)\n  }, [draftSessionId, pendingCollabMode, setPendingCollabMode])"
c = c.replace(old_effect, new_effect, 1)

f.write_text(c, encoding='utf-8')
print("OK: effects updated")
