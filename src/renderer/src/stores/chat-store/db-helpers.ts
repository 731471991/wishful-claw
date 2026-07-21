import type { Session, Project } from './types'

/**
 * DB persistence helpers — placeholder implementations.
 * All functions are no-ops for now (in-memory storage).
 * TODO (迭代五): Implement with SQLite via MessagePack IPC.
 */

export function dbCreateSession(_session: Session): void {
  // Placeholder — 迭代五接入 SQLite
}

export function dbDeleteSession(_sessionId: string): void {
  // Placeholder
}

export function dbUpdateSession(
  _sessionId: string,
  _patch: Partial<Session>
): void {
  // Placeholder
}

export function dbCreateProject(_project: Project): void {
  // Placeholder
}

export function dbDeleteProject(_projectId: string): void {
  // Placeholder
}

export function dbUpdateProject(
  _projectId: string,
  _patch: Partial<Project>
): void {
  // Placeholder
}

export async function dbLoadAll(): Promise<{ projects: Project[]; sessions: Session[] } | null> {
  // Placeholder — 迭代五从 SQLite 加载
  return null
}
