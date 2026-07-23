export interface OrchestrationStage {
  id: string
  name: string
  label?: string
  status: string
}

export interface OrchestrationMember {
  id: string
  name: string
  role: string
  status: string
  iteration?: number
  progress?: number
  toolCallCount?: number
  completedAt?: number | null
  latestAction?: string
  summary?: string
  toolUseId?: string
  report?: string
  currentTaskLabel?: string
  description?: string
  prompt?: string
  agentName?: string
  model?: string
  errorMessage?: string | null
  isSelected?: boolean
}

export interface OrchestrationRun {
  id: string
  status: string
  kind?: string
  sessionId?: string
  stageIndex?: number
  stageCount?: number
  selectedMemberId?: string | null
  completedAt?: number | null
  summary?: string
  latestAction?: string
  stages: OrchestrationStage[]
  members: OrchestrationMember[]
}
