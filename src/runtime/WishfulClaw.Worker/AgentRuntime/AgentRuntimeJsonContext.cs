using System.Text.Json.Serialization;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Source-generated JsonSerializerContext for AgentRuntime types used in reverse requests.
/// </summary>
[JsonSerializable(typeof(AgentRuntimeReverseRequestEnvelope))]
[JsonSerializable(typeof(AgentRuntimeReverseCancelEnvelope))]
[JsonSerializable(typeof(AgentRuntimeReverseResponseResult))]
internal sealed partial class AgentRuntimeJsonContext : JsonSerializerContext
{
}