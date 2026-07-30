using System.Text.Json.Serialization;

namespace WishfulClaw.Agent;

/// <summary>
/// Source-generated JsonSerializerContext for AgentRuntime types used in reverse requests.
/// Must use CamelCase to match the TypeScript side (native-agent-runtime.ts reads
/// request.id, request.method, request.params — all lowercase).
/// </summary>
[JsonSourceGenerationOptions(
    GenerationMode = JsonSourceGenerationMode.Metadata,
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(AgentRuntimeReverseRequestEnvelope))]
[JsonSerializable(typeof(AgentRuntimeReverseCancelEnvelope))]
[JsonSerializable(typeof(AgentRuntimeReverseResponseResult))]
internal sealed partial class AgentRuntimeJsonContext : JsonSerializerContext
{
}
