using WishfulClaw.Contracts;

namespace WishfulClaw.Worker.Modules.OpenAIAudio;

/// <summary>
/// Registers OpenAI audio IPC handlers: transcribe (speech-to-text) and speech (text-to-speech).
/// </summary>
internal sealed class OpenAIAudioModule : IWorkerModule
{
    public string Name => "openai-audio";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("openai-audio/transcribe", OpenAIAudioTools.TranscribeAsync);
        context.Register("openai-audio/speech", OpenAIAudioTools.SpeechAsync);
    }
}
