/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

using System.Net;

namespace WishfulClaw.Infrastructure.Http;

/// <summary>
/// Factory for creating HttpClient instances with sensible defaults.
/// Ported from WishfulClaw WorkerHttpClientFactory (simplified — no WorkerMemory env vars).
/// </summary>
public static class WorkerHttpClientFactory
{
    private static readonly TimeSpan DefaultConnectionIdleTimeout = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan DefaultConnectionLifetime = TimeSpan.FromMinutes(10);
    private const int DefaultMaxConnectionsPerServer = 50;

    public static HttpClient Create(
        TimeSpan? timeout = null,
        bool allowAutoRedirect = true,
        int maxAutomaticRedirections = 10)
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = allowAutoRedirect,
            MaxAutomaticRedirections = maxAutomaticRedirections,
            PooledConnectionIdleTimeout = DefaultConnectionIdleTimeout,
            PooledConnectionLifetime = DefaultConnectionLifetime,
            MaxConnectionsPerServer = DefaultMaxConnectionsPerServer,
            UseProxy = true,
            AutomaticDecompression = DecompressionMethods.None
        };
        var client = new HttpClient(handler, disposeHandler: true);
        if (timeout.HasValue)
        {
            client.Timeout = timeout.Value;
        }
        return client;
    }
}
