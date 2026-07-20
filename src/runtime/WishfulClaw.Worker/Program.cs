using System.Text;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Worker;

Console.OutputEncoding = Encoding.UTF8;

try
{
    var endpoint = WorkerEndpoint.Parse(args);
    await WorkerHost.CreateDefault(endpoint).RunAsync();
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex);
    return 1;
}
