import os

filepath = 'src/runtime/WishfulClaw.Agent/Tools/ShellTools/ShellExecuteTool.cs'
with open(filepath, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

# Common usings for all partial files
common_usings = (
    "using System.Collections.Concurrent;\n"
    "using System.Diagnostics;\n"
    "using System.Text;\n"
    "using System.Text.Json;\n"
    "using System.Threading;\n"
    "using System.Threading.Tasks;\n"
    "using WishfulClaw.Core.Tools;\n"
    "\n"
    "namespace WishfulClaw.Agent.Tools.ShellTools;\n"
    "\n"
)

# 1. Main file: usings + class decl + constants + Name/Description/InputSchema + ExecuteAsync
# Lines 33-255 (0-indexed 32-254): class declaration through end of ExecuteAsync
main_content = common_usings
# class declaration + constants (lines 33-48, 0-indexed 32-47)
for i in range(32, 48):
    main_content += lines[i]
# public members (lines 49-255, 0-indexed 48-254)
for i in range(48, 255):
    main_content += lines[i]
main_content += "}\n"

with open('src/runtime/WishfulClaw.Agent/Tools/ShellTools/ShellExecuteTool.cs', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(main_content)
print("ShellExecuteTool.cs: %d lines" % len(main_content.splitlines()))

# 2. Process file: RunProcessAsync, CreateProcessStartInfo, ApplyEnvironment
# Lines 256-470 (0-indexed 255-469)
process_content = common_usings + "public sealed partial class ShellExecuteTool\n{\n"
for i in range(255, 470):
    process_content += lines[i]
process_content += "}\n"

with open('src/runtime/WishfulClaw.Agent/Tools/ShellTools/ShellExecuteTool.Process.cs', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(process_content)
print("ShellExecuteTool.Process.cs: %d lines" % len(process_content.splitlines()))

# 3. ShellResolution file: ResolveLaunch, GetShellLaunchCandidates, GetLaunchArgs, encoding, IsPowerShell
# Lines 472-740 (0-indexed 471-739)
shell_content = common_usings + "public sealed partial class ShellExecuteTool\n{\n"
for i in range(471, 740):
    shell_content += lines[i]
shell_content += "}\n"

with open('src/runtime/WishfulClaw.Agent/Tools/ShellTools/ShellExecuteTool.ShellResolution.cs', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(shell_content)
print("ShellExecuteTool.ShellResolution.cs: %d lines" % len(shell_content.splitlines()))

# 4. Helpers file: ResolveCwd, ReadStreamAsync, TryKillProcessTree, ElapsedMs
# Lines 742-end (0-indexed 741-end)
helpers_content = common_usings + "public sealed partial class ShellExecuteTool\n{\n"
for i in range(741, len(lines)):
    helpers_content += lines[i]
# Ensure class is closed
stripped = helpers_content.rstrip()
if not stripped.endswith('}'):
    helpers_content += "}\n"
else:
    helpers_content += "\n"

with open('src/runtime/WishfulClaw.Agent/Tools/ShellTools/ShellExecuteTool.Helpers.cs', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(helpers_content)
print("ShellExecuteTool.Helpers.cs: %d lines" % len(helpers_content.splitlines()))

print("\nDone!")
