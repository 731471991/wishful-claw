p = 'src/renderer/src/components/goal/GoalHistoryPanel.tsx'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, f"match {s.count(a)}: {a[:70]}"
    s = s.replace(a, b)

# 1. imports
rep("""import { type SessionGoalEvent } from '@renderer/stores/goal-store-helpers'""",
"""import { type SessionGoalEvent, type SessionGoalPlanTask } from '@renderer/stores/goal-store-helpers'""")

# 2. state + loaders
rep("""  const [selectedGoalId, setSelectedGoalId] = React.useState<string | null>(initialGoalId ?? null)
  const [filter, setFilter] = React.useState<GoalHistoryFilter>('all')""",
"""  const [selectedGoalId, setSelectedGoalId] = React.useState<string | null>(initialGoalId ?? null)
  const [filter, setFilter] = React.useState<GoalHistoryFilter>('all')
  const [expandedPlanId, setExpandedPlanId] = React.useState<string | null>(null)""")

rep("""  const hasMoreEvents = useGoalHistoryStore((state) =>
    selectedKey ? state.eventHasMoreByGoal[selectedKey] ?? false : false
  )""",
"""  const hasMoreEvents = useGoalHistoryStore((state) =>
    selectedKey ? state.eventHasMoreByGoal[selectedKey] ?? false : false
  )
  const planTasks = useGoalHistoryStore((state) =>
    selectedKey ? state.planTasksByGoal[selectedKey] ?? EMPTY_PLAN_TASKS : EMPTY_PLAN_TASKS
  )""")

rep("""  React.useEffect(() => {
    if (!selectedGoal) return
    void useGoalHistoryStore
      .getState()
      .loadGoalEvents(selectedGoal.sessionId, selectedGoal.goalId)
  }, [selectedGoal?.goalId, selectedGoal?.sessionId])""",
"""  React.useEffect(() => {
    if (!selectedGoal) return
    void useGoalHistoryStore
      .getState()
      .loadGoalEvents(selectedGoal.sessionId, selectedGoal.goalId)
    void useGoalHistoryStore
      .getState()
      .loadGoalPlanTasks(selectedGoal.sessionId, selectedGoal.goalId)
  }, [selectedGoal?.goalId, selectedGoal?.sessionId])

  // 刷新事件时（loadMore / 轮询）同步刷新每轮执行记录，保证进行中 goal 实时更新
  React.useEffect(() => {
    if (!selectedGoal || selectedGoal.status !== 'active') return
    const timer = window.setInterval(() => {
      void useGoalHistoryStore
        .getState()
        .loadGoalPlanTasks(selectedGoal.sessionId, selectedGoal.goalId, true)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [selectedGoal?.goalId, selectedGoal?.sessionId, selectedGoal?.status])""")

# 3. constants
rep("""const EMPTY_GOALS: SessionGoal[] = []
const EMPTY_EVENTS: SessionGoalEvent[] = []""",
"""const EMPTY_GOALS: SessionGoal[] = []
const EMPTY_EVENTS: SessionGoalEvent[] = []
const EMPTY_PLAN_TASKS: SessionGoalPlanTask[] = []""")

# 4. replace plans section with expandable cards
rep("""              <div className="space-y-1.5">
                {plans.map((plan, index) => (
                  <div key={plan.planId ?? index} className="rounded-md border border-border/60 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium">{plan.title ?? `Plan ${index + 1}`}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{plan.status ?? 'pending'}</span>
                    </div>
                    {plan.resultSummary ? <p className="mt-1 text-[11px] text-muted-foreground">{plan.resultSummary}</p> : null}
                  </div>
                ))}
              </div>""",
"""              <div className="space-y-1.5">
                {plans.map((plan, index) => {
                  const planKey = plan.planId ?? `plan-${index}`
                  const planRounds = planTasks.filter(
                    (task) => task.planId === plan.planId || task.originalPlanId === plan.planId
                  )
                  const expanded = expandedPlanId === planKey
                  return (
                    <div key={planKey} className="rounded-md border border-border/60 px-2.5 py-2">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left text-xs"
                        onClick={() => setExpandedPlanId(expanded ? null : planKey)}
                      >
                        <span className="min-w-0 truncate font-medium">{plan.title ?? `Plan ${index + 1}`}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {planRounds.length > 0 ? (
                            <span className="rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">
                              {t('goal.history.roundsCount', { count: planRounds.length })}
                            </span>
                          ) : null}
                          <span className="text-[10px] text-muted-foreground">{plan.status ?? 'pending'}</span>
                          <span className="text-[10px] text-muted-foreground">{expanded ? '▴' : '▾'}</span>
                        </span>
                      </button>
                      {plan.resultSummary ? <p className="mt-1 text-[11px] text-muted-foreground">{plan.resultSummary}</p> : null}
                      {expanded ? (
                        planRounds.length > 0 ? (
                          <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
                            {planRounds.map((task) => (
                              <div key={task.id} className="rounded-sm bg-muted/40 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="flex items-center gap-1.5 font-medium">
                                    {t('goal.history.round', { round: task.round })}
                                    {task.adjusted ? (
                                      <span className="rounded-sm bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">
                                        {t('goal.history.adjusted')}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <GoalPlanTaskStatusBadge status={task.status} />
                                    {task.startedAt ? formatRoundDuration(task.startedAt, task.finishedAt) : null}
                                  </span>
                                </div>
                                {task.summary ? <p className="mt-1 text-[11px] text-muted-foreground">{task.summary}</p> : null}
                                {task.evaluationReasoning ? (
                                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                                    <span className="font-medium">{t('goal.history.evaluation')}:</span> {task.evaluationReasoning}
                                  </p>
                                ) : null}
                                {task.steps && task.steps.length > 0 ? (
                                  <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground/80">
                                    {task.steps.map((step, i) => (
                                      <li key={i}>{step}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground/70">
                            {t('goal.history.noRoundRecords')}
                          </p>
                        )
                      ) : null}
                    </div>
                  )
                })}
              </div>""")

open(p, 'w', encoding='utf-8', newline='').write(s)
print('OK')
