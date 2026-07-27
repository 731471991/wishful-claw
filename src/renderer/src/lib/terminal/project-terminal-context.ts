// Stub — terminal support will be added in a future iteration

interface EnsureProjectTerminalReadyOptions {
  projectId?: string | null
  projectName?: string | null
  workingFolder?: string | null
  sshConnectionId?: string | null
}

export function getProjectTerminalBaseTitle(
  projectName?: string | null,
  workingFolder?: string | null
): string {
  const trimmedProjectName = projectName?.trim()
  if (trimmedProjectName) return trimmedProjectName

  const folderName = workingFolder?.split(/[\\/]/).filter(Boolean).pop()?.trim()
  return folderName || 'Terminal'
}

export async function ensureProjectTerminalReady(
  _options: EnsureProjectTerminalReadyOptions
): Promise<string | null> {
  return null
}
