using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Media;

/// <summary>
/// Registers media file IPC handlers: read-file-chunk.
/// Reads binary file data in chunks and returns as base64.
/// </summary>
internal sealed class MediaFileModule : IWorkerModule
{
    public string Name => "media-file";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("media/read-file-chunk", MediaFileTools.ReadChunkAsync);
    }
}
