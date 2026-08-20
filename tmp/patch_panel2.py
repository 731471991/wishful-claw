p = 'src/renderer/src/components/goal/GoalHistoryPanel.tsx'
s = open(p, encoding='utf-8').read()

anchor = """function parsePlans(goal: SessionGoal): GoalPlanSummary[] {"""
helper = """function GoalPlanTaskStatusBadge({ status }: { status: SessionGoalPlanTask['status'] }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const cls =
    status === 'completed'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : status === 'failed'
        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
  return (
    <span className={cn('rounded-sm px-1 text-[10px]', cls)}>
      {t(`goal.history.taskStatus.${status}`)}
    </span>
  )
}

function formatRoundDuration(startedAt: number, finishedAt?: number | null): string {
  if (!startedAt) return ''
  const end = finishedAt ?? Date.now()
  const seconds = Math.max(0, Math.round((end - startedAt) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  if (minutes < 60) return rem > 0 ? `${minutes}m${rem}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${minutes % 60}m`
}

function parsePlans(goal: SessionGoal): GoalPlanSummary[] {"""
assert s.count(anchor) == 1
s = s.replace(anchor, helper)
open(p, 'w', encoding='utf-8', newline='').write(s)
print('OK')
