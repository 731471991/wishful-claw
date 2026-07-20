using System.Text.Json;

namespace WishfulClaw.Contracts;

/// <summary>
/// 模块注册上下文接口。让 IWorkerModule 不直接依赖 Core 层。
/// </summary>
public interface IWorkerModuleContext
{
    void Register(string method, Func<JsonElement, Task<WorkerResponse>> handler);

    void Register(string method, Func<JsonElement, WorkerResponse> handler);

    void Register(string method, Func<JsonElement, IWorkerRequestContext, Task<WorkerResponse>> handler);

    void Register(string method, Func<JsonElement, IWorkerRequestContext, WorkerResponse> handler);

    string[] GetRegisteredMethods();
}
