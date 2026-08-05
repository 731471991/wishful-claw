# Plan 8-2: Frontend — plan-store fix + renderer bridge + sendImplementPlan

## Goal

Wire up the frontend plan mode infrastructure: fix IPC calls, connect reverse request handler, implement user approval flow.

## Steps

### 1. Fix plan-store.ts IPC calls

- Replace `invokeMessagePackBinary(DB_PLANS_*)` with `window.api.workerRequest('db/plans-*', ...)`
- Remove imports of `DB_PLANS_*_MSGPACK_CHANNEL` from binary-ipc
- Keep all store logic (status flow, dormant release, sync from native) unchanged

### 2. Wire plan/ui-update in renderer-tool-bridge.ts

- Import `handleNativePlanUiUpdate` from plan-native-ui.ts
- Add `plan/ui-update` case in `handleRendererToolRequest()`
- Call `handleNativePlanUiUpdate(payload.params)` and send response

### 3. Implement sendImplementPlan in use-chat-actions.ts

- Get plan from plan-store, verify status is `awaiting_review`
- Set plan status to `approved` via `updatePlan`
- Exit plan mode in ui-store
- Send "Implement the approved plan." message to agent in the plan's session
- Switch to code mode if session was in clarify mode

### 4. Implement sendPlanRevision (reject with feedback)

- Set plan status to `rejected`
- Re-enter plan mode
- Send rejection feedback message to agent

### 5. Update PlanReviewCard integration

- Wire approve button → `sendImplementPlan`
- Wire reject button → `sendPlanRevision`
- Ensure PlanReviewCard renders plan content from plan-store

## Verification

- `npx tsc --noEmit -p tsconfig.web.json` zero errors
- `npx tsc --noEmit -p tsconfig.node.json` zero errors
- Plan store loads/saves plans via workerRequest
- plan/ui-update reverse request reaches renderer and syncs plan store
- Approve button sends implementation message to agent
- Reject button sends feedback to agent
