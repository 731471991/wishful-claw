/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

using WishfulClaw.Contracts;
using WishfulClaw.Agent.Tools.AgentChanges;

namespace WishfulClaw.Worker.Modules.AgentChanges;

/// <summary>
/// Registers agent change tracking IPC handlers.
/// Tracks file changes made by the Agent and supports diff/rollback.
/// Uses in-memory storage (no SQLite dependency).
/// </summary>
internal sealed class AgentChangeModule : IWorkerModule
{
    public string Name => "agent-changes";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("agent-changes/list-session-hydrated", AgentChangeTools.ListSessionHydrated);
        context.Register("agent-changes/get-hydrated", AgentChangeTools.GetHydrated);
        context.Register("agent-changes/diff-local", AgentChangeTools.DiffLocal);
        context.Register("agent-changes/rollback-local-change", AgentChangeTools.RollbackLocalChange);
    }
}
