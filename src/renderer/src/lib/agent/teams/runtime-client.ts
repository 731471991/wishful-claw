import type {
  AppendTeamRuntimeMessageArgs,
  ConsumeTeamRuntimeMessagesArgs,
  CreateTeamRuntimeArgs,
  DeleteTeamRuntimeArgs,
  GetTeamRuntimeSnapshotArgs,
  TeamRuntimeCreateResult,
  TeamRuntimeMessageRecord,
  TeamRuntimeSnapshot,
  UpdateTeamRuntimeManifestArgs,
  UpdateTeamRuntimeMemberArgs
} from '../../../../../shared/team-runtime-types'

export async function createTeamRuntime(
  args: CreateTeamRuntimeArgs
): Promise<TeamRuntimeCreateResult> {
  return window.api.teamRuntimeCreate(args)
}

export async function deleteTeamRuntime(args: DeleteTeamRuntimeArgs): Promise<{ success: true }> {
  return window.api.teamRuntimeDelete(args)
}

export async function appendTeamRuntimeMessage(
  args: AppendTeamRuntimeMessageArgs
): Promise<{ success: true }> {
  return window.api.teamRuntimeAppendMessage(args)
}

export async function getTeamRuntimeSnapshot(
  args: GetTeamRuntimeSnapshotArgs
): Promise<TeamRuntimeSnapshot | null> {
  return window.api.teamRuntimeGetSnapshot(args)
}

export async function updateTeamRuntimeMember(
  args: UpdateTeamRuntimeMemberArgs
): Promise<{ success: true }> {
  return window.api.teamRuntimeUpdateMember(args)
}

export async function updateTeamRuntimeManifest(
  args: UpdateTeamRuntimeManifestArgs
): Promise<{ success: true }> {
  return window.api.teamRuntimeUpdateManifest(args)
}

export async function consumeTeamRuntimeMessages(
  args: ConsumeTeamRuntimeMessagesArgs
): Promise<TeamRuntimeMessageRecord[]> {
  return window.api.teamRuntimeConsumeMessages(args)
}
