/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import { encodeToolError } from '../../../tools/tool-result-format'

export function nativeOnlyTeamResult(toolName: string): string {
  return encodeToolError(
    `${toolName} executes in the .NET Native Worker and is unavailable through the renderer boundary.`
  )
}
