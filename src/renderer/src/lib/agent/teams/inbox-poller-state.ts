// Shared mutable state for inbox poller — ES module imports are read-only,
// so we use a mutable object to allow cross-file mutation.

export const inboxPollerState = {
  pollerTimer: null as ReturnType<typeof setInterval> | null,
  pollerStartedAt: 0,
  activePollTeamKey: null as string | null,
}
