/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Storage;

namespace WishfulClaw.Worker;

internal sealed class ConfigModule : IWorkerModule
{
    public string Name => "config";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("config/read", ConfigStore.Read);
        context.Register("config/write", ConfigStore.Write);
        context.Register("config/get", ConfigStore.Get);
        context.Register("config/set", ConfigStore.Set);
        context.Register("config/delete", ConfigStore.Delete);
    }
}
