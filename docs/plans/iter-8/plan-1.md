# Plan 8-1: Backend — DB plans table + plan executor enhancement

## Goal

Build the backend foundation for plan mode: DB persistence, reverse request notification, state file, and step tracking tool.

## Steps

### 1. Add plans table to DbClient

- Add `PlanEntity` to Infrastructure/Db/Entities/
- Register in `DbClient.InitTables()`
- Fields: id, session_id, title, status, file_path, content, spec_json, created_at, updated_at

### 2. Add DbPlanTools + DbPlanModels

- `DbPlanModels.cs` — PlanRow model + result records (adapted from OpenCowork)
- `DbPlanTools.cs` — List/Get/GetBySession/Create/Update/Delete (adapted from OpenCowork, using SqlSugar)
- Place in `Infrastructure/Db/`

### 3. Register plan DB handlers in DbModule

- Add `db/plans-list`, `db/plans-get`, `db/plans-get-by-session`, `db/plans-create`, `db/plans-update`, `db/plans-delete` to `DbModule.Register()`

### 4. Enhance AgentRuntimePlanExecutor

- Change plan directory from `.plan/` to `.wishful-claw/plans/`
- Add DB persistence (use DbPlanTools for CRUD)
- Add `NotifyPlanUiAsync` reverse request (from OpenCowork) — sends `plan/ui-update` to frontend
- Add state file persistence (`.wishful-claw/plans/{planId}.state.json`) with step tracking
- Add `UpdatePlanStep` tool — Agent updates step status during execution
- Wire `UpdatePlanStep` into `IsPlanTool()` and `ExecuteAsync()`

### 5. Update PlanToolProvider

- Add `UpdatePlanStep` tool definition
- Fix EnterPlanMode/ExitPlanMode schemas to match OpenCowork

### 6. Update ToolDispatchRouter

- Ensure `UpdatePlanStep` routes to `AgentRuntimePlanExecutor`

### 7. PromptBuilder guidance

- Add plan mode system prompt guidance (when to use EnterPlanMode, how to write plans, when to use UpdatePlanStep)

## Verification

- `dotnet build` zero errors
- `npx tsc --noEmit -p tsconfig.web.json` zero errors
- Plans table created in SQLite
- EnterPlanMode creates plan in DB + file + sends UI update
- ExitPlanMode updates plan status + sends UI update
- UpdatePlanStep updates state file + sends UI update
