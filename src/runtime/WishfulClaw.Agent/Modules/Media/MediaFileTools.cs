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
/// Media file tools — reads binary file data in chunks for media playback.
/// </summary>
public static class MediaFileTools
{
    private const int DefaultChunkBytes = 256 * 1024;
    private const int MaxChunkBytes = 512 * 1024;

    public static async Task<WorkerResponse> ReadChunkAsync(
        JsonElement parameters,
        IWorkerRequestContext context)
    {
        var filePath = JsonHelpers.GetString(parameters, "filePath")?.Trim();
        if (string.IsNullOrWhiteSpace(filePath))
        {
            throw new InvalidOperationException("Media chunk read requires filePath.");
        }

        var offset = Math.Max(0, JsonHelpers.GetLong(parameters, "offset", 0));
        var requestedLength = Math.Clamp(
            JsonHelpers.GetInt(parameters, "length", DefaultChunkBytes),
            1,
            MaxChunkBytes);
        var deleteWhenDone = JsonHelpers.GetBool(parameters, "deleteWhenDone", false);

        byte[] bytes;
        long nextOffset;
        bool done;

        await using (var stream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            DefaultChunkBytes,
            FileOptions.Asynchronous | FileOptions.SequentialScan))
        {
            if (offset > stream.Length)
            {
                throw new InvalidOperationException("Media chunk offset exceeds file length.");
            }

            stream.Position = offset;
            var length = (int)Math.Min(requestedLength, stream.Length - offset);
            bytes = GC.AllocateUninitializedArray<byte>(length);
            var total = 0;
            while (total < length)
            {
                var read = await stream.ReadAsync(bytes.AsMemory(total, length - total), context.CancellationToken);
                if (read == 0)
                {
                    break;
                }
                total += read;
            }

            if (total != bytes.Length)
            {
                Array.Resize(ref bytes, total);
            }

            nextOffset = offset + total;
            done = nextOffset >= stream.Length;
        }

        if (done && deleteWhenDone)
        {
            try
            {
                File.Delete(filePath);
            }
            catch (IOException)
            {
                // The chunk is already available; cleanup is best effort.
            }
        }

        var base64 = Convert.ToBase64String(bytes);

        return WorkerResponse.FromWriter(writer =>
        {
            writer.WriteStartObject();
            writer.WriteString("data", base64);
            writer.WriteNumber("offset", offset);
            writer.WriteNumber("nextOffset", nextOffset);
            writer.WriteBoolean("done", done);
            writer.WriteNumber("bytes", bytes.Length);
            writer.WriteEndObject();
        });
    }
}
