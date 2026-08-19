/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

using WishfulClaw.Contracts;

namespace WishfulClaw.Agent.Modules.Video;

/// <summary>
/// Seedance (Volcengine Ark) async video generation module.
/// generate: POST {baseUrl}/contents/generations/tasks → { id }
/// status:   GET  {baseUrl}/contents/generations/tasks/{id} → { status, content.video_url }
/// download: GET  {video_url} → base64 mp4 (url expires ~1h, fetched server-side)
/// </summary>
public sealed class SeedanceVideoModule : IWorkerModule
{
    public string Name => "seedance-video";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("seedance-video/generate", SeedanceVideoTools.GenerateAsync);
        context.Register("seedance-video/status", SeedanceVideoTools.StatusAsync);
        context.Register("seedance-video/download", SeedanceVideoTools.DownloadAsync);
    }
}
