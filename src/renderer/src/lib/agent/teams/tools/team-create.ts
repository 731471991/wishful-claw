/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import type { ToolHandler } from '../../../tools/tool-types'
import { nativeOnlyTeamResult } from './team-native-guard'

export const teamCreateTool: ToolHandler = {
  definition: {
    name: 'TeamCreate',
    description:
      'Create a new agent team for parallel collaboration. Use this when a task benefits from multiple agents working simultaneously on different aspects.',
    inputSchema: {
      type: 'object',
      properties: {
        team_name: {
          type: 'string',
          description: 'Short, descriptive name for the team (e.g. "pr-review", "bug-fix-squad")'
        },
        description: {
          type: 'string',
          description: 'What this team is working on'
        },
        default_backend: {
          type: 'string',
          enum: ['in-process'],
          description:
            'Optional default backend for teammate execution. Teams execute in the .NET Native Worker.'
        }
      },
      required: ['team_name', 'description']
    }
  },
  execute: async () => nativeOnlyTeamResult('TeamCreate'),
  requiresApproval: () => false
}
