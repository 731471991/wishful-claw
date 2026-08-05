# Plan 8-3: Frontend — plan panel UI with step tracking

## Goal

Create the plan panel showing step list with real-time status + verification results.

## Steps

### 1. Define plan step types

- Add `PlanStep` interface to plan-store.ts (id, title, status, result)
- Add `steps` field to `Plan` interface
- Add step update actions to store

### 2. Create PlanPanel component

- Step list with status icons (pending/in_progress/completed/failed)
- Plan title + overall status badge
- Real-time updates from plan-store (driven by plan/ui-update reverse requests)
- Minimal design, fits in right panel or as overlay

### 3. Integrate PlanPanel into layout

- Show PlanPanel when plan mode is active or plan exists for active session
- Auto-hide when no plan exists
- Don't interfere with existing right panel tabs

### 4. Update PlanReviewCard

- Show step list from plan state in review card
- Update approve/reject buttons to use new sendImplementPlan/sendPlanRevision

## Verification

- `npx tsc --noEmit` all three configs zero errors
- Plan panel shows when Agent enters plan mode
- Steps update in real-time as Agent calls UpdatePlanStep
- Approve/reject flow works end-to-end
