import { ipcClient } from '../ipc/ipc-client'

type SkillMeta = { name: string; description: string; enabled?: boolean }

let registeredSkills: SkillMeta[] = []
let registeredSkillSignature = ''

export function getRegisteredSkills(): SkillMeta[] {
  return registeredSkills.slice()
}

function normalizeSkills(skills: SkillMeta[]): SkillMeta[] {
  return skills
    .map((skill) => ({
      name: String(skill.name ?? '').trim(),
      description: String(skill.description ?? '').trim()
    }))
    .filter((skill) => skill.name)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
}

function buildSkillSignature(skills: SkillMeta[]): string {
  return JSON.stringify(skills)
}

async function loadRegisteredSkills(): Promise<SkillMeta[] | null> {
  try {
    const result = await ipcClient.invoke('skills:list')
    return Array.isArray(result) ? (result as SkillMeta[]).filter(s => s.enabled !== false) : []
  } catch (err) {
    console.error('[Skills] Failed to load skills from IPC:', err)
    return null
  }
}

export async function refreshSkillTools(): Promise<void> {
  const nextSkills = await loadRegisteredSkills()
  if (!nextSkills) {
    // Skills not loaded yet; metadata will be empty until next refresh.
    return
  }

  const normalizedSkills = normalizeSkills(nextSkills)
  const nextSignature = buildSkillSignature(normalizedSkills)
  if (nextSignature === registeredSkillSignature) return

  // Skills are no longer registered as individual tools.
  // They are accessed via use_capability(action="call", capability_id="skill:name").
  // We only track metadata for the capability route text and
  // the mcp:capability-list reverse-request handler.
  registeredSkills = normalizedSkills
  registeredSkillSignature = nextSignature
}
