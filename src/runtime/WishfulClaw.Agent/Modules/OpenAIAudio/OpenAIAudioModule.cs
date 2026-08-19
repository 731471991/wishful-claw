/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

using WishfulClaw.Contracts;

namespace WishfulClaw.Agent.Modules.OpenAIAudio;

/// <summary>
/// Registers OpenAI audio IPC handlers: transcribe (speech-to-text) and speech (text-to-speech).
/// </summary>
public sealed class OpenAIAudioModule : IWorkerModule
{
    public string Name => "openai-audio";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("openai-audio/transcribe", OpenAIAudioTools.TranscribeAsync);
        context.Register("openai-audio/speech", OpenAIAudioTools.SpeechAsync);
    }
}
