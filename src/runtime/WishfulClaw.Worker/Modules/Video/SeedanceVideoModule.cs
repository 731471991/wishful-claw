using WishfulClaw.Contracts;

namespace WishfulClaw.Worker.Modules.Video;

/// <summary>
/// Seedance (Volcengine Ark) async video generation module.
/// generate: POST {baseUrl}/contents/generations/tasks → { id }
/// status:   GET  {baseUrl}/contents/generations/tasks/{id} → { status, content.video_url }
/// download: GET  {video_url} → base64 mp4 (url expires ~1h, fetched server-side)
/// </summary>
internal sealed class SeedanceVideoModule : IWorkerModule
{
    public string Name => "seedance-video";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("seedance-video/generate", SeedanceVideoTools.GenerateAsync);
        context.Register("seedance-video/status", SeedanceVideoTools.StatusAsync);
        context.Register("seedance-video/download", SeedanceVideoTools.DownloadAsync);
    }
}
