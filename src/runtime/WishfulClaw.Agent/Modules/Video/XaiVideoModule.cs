/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

using WishfulClaw.Contracts;

namespace WishfulClaw.Agent.Modules.Video;

/// <summary>
/// xAI-compatible asynchronous video generation module.
/// generate: POST {baseUrl}/xai/v1/videos/generations → { request_id }
/// status:   GET  {baseUrl}/xai/v1/videos/{request_id} → { status, video.url }
/// </summary>
public sealed class XaiVideoModule : IWorkerModule
{
    public string Name => "xai-video";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("xai-video/generate", XaiVideoTools.GenerateAsync);
        context.Register("xai-video/status", XaiVideoTools.StatusAsync);
        context.Register("xai-video/download", XaiVideoTools.DownloadAsync);
    }
}
