using System.Text.Json;

namespace WishfulClaw.Agent.Modules.Extensions;

public sealed record NativeExtensionToolExecutionResult(bool Success, string? Content, string? Error);

public sealed record NativeExtensionInstance(
    string Id,
    bool Enabled,
    IReadOnlyDictionary<string, string> Config,
    NativeExtensionManifest Manifest);

public sealed record NativeExtensionManifest(
    int SchemaVersion,
    string Id,
    string Name,
    string Version,
    IReadOnlyList<NativeExtensionConfigField> ConfigSchema,
    IReadOnlyList<string> NetworkPermissions,
    IReadOnlyList<NativeExtensionToolDefinition> Tools);

public sealed record NativeExtensionConfigField(
    string Key,
    string Type,
    string? DefaultValue);

public sealed record NativeExtensionToolDefinition(
    string Name,
    string Kind,
    NativeExtensionHttpDefinition? Http,
    string? Handler);

public sealed record NativeExtensionHttpDefinition(
    string Method,
    string Url,
    IReadOnlyDictionary<string, string> Headers,
    JsonElement? Body);
