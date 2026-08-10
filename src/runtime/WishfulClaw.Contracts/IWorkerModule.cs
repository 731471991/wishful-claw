namespace WishfulClaw.Contracts;

/// <summary>
/// Worker 模块接口。每个模块自包含，通过 Register 方法注册自己的 IPC 方法。
/// InitializeAsync 在服务启动后调用，用于需要启动时初始化的模块（如 Goal 恢复）。
/// </summary>
public interface IWorkerModule
{
    string Name { get; }

    void Register(IWorkerModuleContext context);

    /// <summary>
    /// 服务启动后调用，用于需要启动时初始化的模块。
    /// 默认空实现，不需要初始化的模块无需重写。
    /// </summary>
    Task InitializeAsync() => Task.CompletedTask;
}
