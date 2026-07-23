/**
 * Persona type definitions — mirrors backend PersonaModels.cs.
 */

/** Lightweight summary for list views. */
export interface PersonaSummary {
  id: string
  name: string
  tagline: string
  description: string
  isBuiltin: boolean
}

/** Full persona content — all four markdown files. */
export interface PersonaConfig {
  id: string
  name: string
  tagline: string
  description: string
  isBuiltin: boolean
  identityMarkdown: string
  soulMarkdown: string
  ontologyMarkdown: string
  agentsMarkdown: string
}

/** Persona file metadata for tab rendering. */
export interface PersonaFileDef {
  key: PersonaFileKey
  label: string
  fileName: string
  description: string
}

export type PersonaFileKey =
  | 'identityMarkdown'
  | 'soulMarkdown'
  | 'ontologyMarkdown'
  | 'agentsMarkdown'

export const PERSONA_FILES: PersonaFileDef[] = [
  {
    key: 'identityMarkdown',
    label: 'IDENTITY',
    fileName: 'IDENTITY.md',
    description: '身份信息：姓名、背景、角色定位、外在印象、内在特质'
  },
  {
    key: 'soulMarkdown',
    label: 'SOUL',
    fileName: 'SOUL.md',
    description: '灵魂：核心性格、沟通风格、互动模式、底线、原则'
  },
  {
    key: 'ontologyMarkdown',
    label: 'ONTOLOGY',
    fileName: 'ONTOLOGY.md',
    description: '认知/价值观：本质定义、能力边界、价值观优先级、诚实性原则'
  },
  {
    key: 'agentsMarkdown',
    label: 'AGENTS',
    fileName: 'AGENTS.md',
    description: '行为准则：记忆写入边界、工具使用原则、安全策略、错误处理'
  }
]

/** Create an empty persona config (for new persona creation). */
export function createEmptyPersonaConfig(): PersonaConfig {
  return {
    id: '',
    name: '',
    tagline: '',
    description: '',
    isBuiltin: false,
    identityMarkdown: '',
    soulMarkdown: '',
    ontologyMarkdown: '',
    agentsMarkdown: ''
  }
}
