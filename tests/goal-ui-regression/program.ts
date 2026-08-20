import {
  applyGoalProgressState,
  applyGoalStatusToProjects,
  isRuntimeGoalVisible,
  type GoalRuntimeState
} from '../../src/renderer/src/stores/goal-state-transitions'
import { GoalConfirmResolvers } from '../../src/renderer/src/lib/tools/goal-confirm-resolvers'
import type {
  GoalProgressState,
  SessionGoal,
  SessionGoalStatus
} from '../../src/renderer/src/stores/goal-store-helpers'

let passed = 0

function assert(condition: boolean, name: string): void {
  if (!condition) throw new Error(name)
  passed += 1
  console.log(`PASS: ${name}`)
}

function goal(goalId: string, projectId: string, status: SessionGoalStatus): SessionGoal {
  return {
    sessionId: 'session-a',
    goalId,
    projectId,
    objective: goalId,
    status,
    tokensUsed: 0,
    timeUsedSeconds: 0,
    plansJson: null,
    planCount: 0,
    completedPlanCount: 0,
    currentPlanIndex: -1,
    workingFolder: null,
    createdAt: 1,
    updatedAt: 1
  }
}

function progress(goalId: string, status: string): GoalProgressState {
  return {
    sessionId: 'session-a',
    goalId,
    eventType: 'GoalCompleted',
    message: status,
    status,
    runState: 'running',
    currentPlanIndex: 0,
    planCount: 1,
    completedPlans: status === 'complete' ? 1 : 0,
    timestamp: 5
  }
}

const current = goal('goal-new', 'project-a', 'active')
const state: GoalRuntimeState = {
  goalsBySession: { 'session-a': current },
  goalProgressBySession: { 'session-a': progress('goal-new', 'active') },
  goalRunStatesBySession: { 'session-a': 'running' },
  activeGoalRunsBySession: { 'session-a': { goalId: 'goal-new', startedAt: 2 } }
}
const afterLateTerminal = applyGoalProgressState(state, progress('goal-old', 'complete'), 10)
assert(afterLateTerminal.goalsBySession['session-a']?.goalId === 'goal-new',
  'late terminal progress keeps the new current goal')
assert(afterLateTerminal.goalProgressBySession['session-a']?.goalId === 'goal-new',
  'late terminal progress keeps the new progress snapshot')
assert(afterLateTerminal.activeGoalRunsBySession['session-a']?.goalId === 'goal-new',
  'late terminal progress keeps the new owned run')

assert(isRuntimeGoalVisible(goal('goal-active', 'project-a', 'active')),
  'chat runtime bar displays active goals')
assert(!isRuntimeGoalVisible(goal('goal-pending', 'project-a', 'pending')),
  'chat runtime bar excludes pending goals')
assert(!isRuntimeGoalVisible(goal('goal-terminal', 'project-a', 'complete')),
  'chat runtime bar excludes terminal goals')

const projects = {
  'project-a': [goal('goal-shared', 'project-a', 'active')],
  'project-b': [goal('goal-shared', 'project-b', 'active')]
}
const updatedProjects = applyGoalStatusToProjects(
  projects,
  ['project-a'],
  'session-a',
  'goal-shared',
  'aborted',
  9
)
assert(updatedProjects['project-a'][0].status === 'aborted'
    && updatedProjects['project-b'][0].status === 'active',
  'project history status update does not leak across project caches')

const resolvers = new GoalConfirmResolvers()
let response: boolean | undefined
resolvers.register('goal-pending', (payload) => { response = payload.confirmed })
assert(resolvers.resolve('goal-pending', false) && response === false,
  'pending confirm cancel resolves false')
assert(!resolvers.has('goal-pending') && !resolvers.resolve('goal-pending', false),
  'pending confirm cancel releases the resolver exactly once')

console.log(`Goal UI regression tests passed: ${passed}`)
