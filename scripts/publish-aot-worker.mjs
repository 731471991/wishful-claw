// AOT Worker 编译脚本
// 自动检测 VS Build Tools 路径，初始化 C++ 环境，然后执行 dotnet publish AOT
import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

console.log('[AOT Worker] 正在检测 Visual Studio Build Tools...')

// 常见的 vcvars64.bat 安装路径
const vsBase = 'C:\\Program Files (x86)\\Microsoft Visual Studio'
const versions = [19, 18, 17, 16, 15]
const editions = ['BuildTools', 'Community', 'Professional', 'Enterprise']
const vcvarsRelPath = 'VC\\Auxiliary\\Build\\vcvars64.bat'

let vcvarsPath = null
for (const ver of versions) {
  for (const ed of editions) {
    const candidate = join(vsBase, String(ver), ed, vcvarsRelPath)
    if (existsSync(candidate)) {
      vcvarsPath = candidate
      break
    }
  }
  if (vcvarsPath) break
}

if (!vcvarsPath) {
  console.error('[AOT Worker] [错误] 未找到 vcvars64.bat')
  console.error('[AOT Worker] 请安装 Visual Studio Build Tools:')
  console.error('[AOT Worker] https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio')
  process.exit(1)
}

console.log(`[AOT Worker] 找到 vcvars64.bat: ${vcvarsPath}`)

// 构建 cmd 命令：先调用 vcvars64.bat 初始化 C++ 环境，再跑 dotnet publish
const dotnetCmd = [
  `dotnet publish "${join(projectRoot, 'src/runtime/WishfulClaw.Worker/WishfulClaw.Worker.csproj')}"`,
  '-c Release',
  '-r win-x64',
  '--self-contained true',
  `-o "${join(projectRoot, 'resources/worker')}"`
].join(' ')

const cmd = `call "${vcvarsPath}" >nul 2>&1 && set "PATH=C:\\Windows\\System32;C:\\Windows;%PATH%;C:\\Program Files\\dotnet" && ${dotnetCmd}`

console.log('[AOT Worker] 开始 AOT 编译...')
console.log('[AOT Worker] 这可能需要几分钟，请耐心等待...')

try {
  execSync(cmd, {
    cwd: projectRoot,
    shell: 'C:\\Windows\\System32\\cmd.exe',
    stdio: 'inherit',
    timeout: 600000 // 10 分钟超时
  })
} catch (err) {
  console.error(`[AOT Worker] [错误] AOT 编译失败: ${err.message}`)
  process.exit(1)
}

console.log('[AOT Worker] AOT 编译成功！')

// 删除 pdb 调试符号
const workerDir = join(projectRoot, 'resources/worker')
if (existsSync(workerDir)) {
  const pdbFiles = ['*.pdb']
  for (const pattern of pdbFiles) {
    const files = execSync(`dir /b "${workerDir}\\${pattern}" 2>nul`, { shell: 'C:\\Windows\\System32\\cmd.exe' })
      .toString().trim().split('\n').filter(Boolean)
    for (const f of files) {
      rmSync(join(workerDir, f.trim()))
    }
  }
  console.log('[AOT Worker] 已删除 .pdb 调试符号文件')
}

// 显示产物
const result = execSync(`dir "${workerDir}\\WishfulClaw.Worker.exe"`, { shell: 'C:\\Windows\\System32\\cmd.exe' }).toString()
console.log('[AOT Worker] 产物:')
console.log(result)
console.log('[AOT Worker] 完成！')