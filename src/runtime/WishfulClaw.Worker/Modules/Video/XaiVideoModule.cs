using WishfulClaw.Contracts;

namespace WishfulClaw.Worker.Modules.Video;

/// <summary>
/// xAI-compatible asynchronous video generation module.
/// generate: POST {baseUrl}/xai/v1/videos/generations → { request_id }
/// status:   GET  {baseUrl}/xai/v1/videos/{request_id} → { status, video.url }
/// </summary>
internal sealed class XaiVideoModule : IWorkerModule
{
    public string Name => "xai-video";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("xai-video/generate", XaiVideoTools.GenerateAsync);
        context.Register("xai-video/status", XaiVideoTools.StatusAsync);
        context.Register("xai-video/download", XaiVideoTools.DownloadAsync);
    }
}
