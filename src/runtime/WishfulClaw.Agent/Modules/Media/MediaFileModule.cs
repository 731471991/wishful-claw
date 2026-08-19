/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent.Modules.Media;

/// <summary>
/// Registers media file IPC handlers: read-file-chunk.
/// Reads binary file data in chunks and returns as base64.
/// </summary>
public sealed class MediaFileModule : IWorkerModule
{
    public string Name => "media-file";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("media/read-file-chunk", MediaFileTools.ReadChunkAsync);
    }
}
