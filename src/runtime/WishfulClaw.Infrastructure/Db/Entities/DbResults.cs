namespace WishfulClaw.Infrastructure.Db;

// ─── DB Infrastructure Result Records ───

public sealed record DbInitializeResult(bool Success, string DbPath, string? Error);
