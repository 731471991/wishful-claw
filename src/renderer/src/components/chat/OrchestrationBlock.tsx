/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import type { OrchestrationRun } from '@renderer/lib/orchestration/types'
import { useUIStore } from '@renderer/stores/ui-store'
import { OrchestrationMemberStrip } from './OrchestrationMemberStrip'

export function OrchestrationBlock({ run }: { run: OrchestrationRun }): React.JSX.Element {
  const openOrchestrationMember = useUIStore((s) => s.openOrchestrationMember)
  const openSubAgentExecutionDetail = useUIStore((s) => s.openSubAgentExecutionDetail)

  const openMember = (member: OrchestrationRun['members'][number]): void => {
    if (member.toolUseId) {
      openSubAgentExecutionDetail(
        member.toolUseId,
        member.report || member.summary || undefined,
        member.name,
        run.sessionId
      )
      return
    }
    openOrchestrationMember(run.id, member.id)
  }

  return (
    <div className="my-2">
      <OrchestrationMemberStrip members={run.members} onOpenMember={openMember} />
    </div>
  )
}
