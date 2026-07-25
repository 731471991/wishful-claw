using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Agent runtime module: registers agent/run, agent/cancel, agent/request-stop,
/// agent/append-messages, and agent/reverse-response.
/// </summary>
internal sealed class AgentRuntimeModule : IWorkerModule
{
    public string Name => "agent-runtime";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("agent/run", AgentRuntimeTools.RunAsync);
        context.Register("agent/cancel", AgentRuntimeTools.Cancel);
        context.Register("agent/request-stop", AgentRuntimeTools.RequestStop);
        context.Register("agent/append-messages", AgentRuntimeTools.AppendMessages);
        context.Register("agent/reverse-response", AgentRuntimeTools.ReverseResponse);
    }
}
