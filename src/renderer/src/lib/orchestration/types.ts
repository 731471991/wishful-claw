export interface OrchestrationStage {
  id: string
  name: string
  status: string
}

export interface OrchestrationMember {
  id: string
  name: string
  role: string
  status: string
}

export interface OrchestrationRun {
  id: string
  status: string
  stages: OrchestrationStage[]
  members: OrchestrationMember[]
}
