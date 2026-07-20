namespace WishfulClaw.Contracts;

/// <summary>
/// Worker 模块接口。每个模块自包含，通过 Register 方法注册自己的 IPC 方法。
/// </summary>
public interface IWorkerModule
{
    string Name { get; }

    void Register(IWorkerModuleContext context);
}
