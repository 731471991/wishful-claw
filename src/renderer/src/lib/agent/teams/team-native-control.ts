/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

const pendingShutdownRequests = new Set<string>()

export function requestTeammateShutdown(memberId: string): void {
  pendingShutdownRequests.add(memberId)
}

export function abortTeammate(_memberIdOrName: string): boolean {
  return false
}

export function abortAllTeammates(): void {
  pendingShutdownRequests.clear()
}

export function isTeammateRunning(_memberIdOrName: string): boolean {
  return false
}
