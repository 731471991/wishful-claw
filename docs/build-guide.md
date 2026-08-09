# Wishful Claw 构建与打包指南

## 构建工具链

| 工具 | 用途 | 配置位置 |
|------|------|----------|
| `electron-vite` | 编译 Electron 主进程 + Preload + React 渲染进程 | `electron.vite.config.ts` |
| `electron-builder` | 打包为安装包/绿色版 | `electron-builder.yml` |
| `dotnet publish` | 编译 .NET Worker 子进程（AOT 自包含） | `scripts/publish-aot-worker.mjs`（自动检测 VS + C++ 环境） |

## 前置条件

- Node.js 20+
- .NET 10 SDK
- Visual Studio 2022 Build Tools（含 C++ 工具链，用于编译 node-pty 等原生模块）

## 脚本命令

### 开发

```bash
npm run dev          # 仅前端开发（需先手动编译 .NET Worker）
npm run dev:full     # 编译 .NET Worker + 前端开发（推荐）
```

### 打包

```bash
npm run pack                     # 前端打包 + electron-builder --dir（不解压目录）
npm run pack:full                # 完整流程：编译 Worker → 前端打包 → 不解压目录
npm run pack:zip                 # 打包并生成绿色版 zip 压缩包
npm run pack:installer           # 前端打包 + NSIS 安装器
npm run pack:installer:full      # 完整流程：编译 Worker → 前端打包 → NSIS 安装器
```

### 输出产物

| 命令 | 产物路径 | 说明 |
|------|----------|------|
| `npm run pack` | `release/win-unpacked/` | 解压目录，可直接运行 `Wishful Claw.exe` |
| `npm run pack:full` | `release/win-unpacked/` | 同上，含最新 .NET Worker |

## 打包流程详解

### 1. 编译 .NET Worker

```bash
npm run build:worker:prod
```

使用 **自包含发布**（`PublishSingleFile=true`），输出到 `resources/worker/`：

```bash
dotnet publish src/runtime/WishfulClaw.Worker/WishfulClaw.Worker.csproj \
  -c Release \
  -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -o resources/worker
```

> 自包含发布约 80-100MB（含 .NET 运行时），目标机器不需要安装 .NET 运行时。
> 未来计划切换为 AOT 编译（`PublishAot=true`）以减小体积，但需先解决底层反射代码的兼容问题。
> **每次打包都必须重新编译 Worker**（使用 `pack:full` 或 `pack:installer:full`），信不过历史编译。
> 仅打包前端（`pack` / `pack:installer`）不会重新编译 Worker。

### 2. 编译前端

```bash
npm run build
# 或 npx electron-vite build
```

输出到 `out/` 目录（main/preload/renderer 三个子目录）。

### 3. electron-builder 打包

```bash
npx electron-builder --dir          # 绿色版（不解压目录）
npx electron-builder --win          # NSIS 安装器
```

配置在 `electron-builder.yml` 中（参考 OpenCowork 的配置方式）：

- `extraResources`：将 `resources/worker/` 中的 .NET Worker 复制到安装包的 `resources/worker/` 目录
- `files`：只包含 `out/**/*`（Vite 打包后的产物），排除 node_modules 中已被 Vite 打包的前端包
- `asarUnpack`：`resources/**` 和原生模块（node-pty、ssh2 等）从 asar 中解出
- `npmRebuild: false`：跳过原生模块重建（依赖 prebuilt 二进制文件）
- `win.icon`：`resources/icon.ico`（由 `resources/icon.png` 生成）
- `win.target`：NSIS 安装器
- 跨平台：已配置 win/mac/linux 三平台目标

## 参考来源

打包方案参考了 `D:\claw\OpenCowork` 项目：

| 参考文件 | 关键内容 | 对应 Wishful Claw 文件 |
|----------|---------|----------------------|
| `electron-builder.yml` | 构建配置、files 排除规则、asarUnpack | `electron-builder.yml` |
| `scripts/publish-native-worker.mjs` | .NET Worker AOT 编译脚本 | `package.json` 的 `build:worker:prod` |
| `scripts/postinstall.mjs` | 原生模块重建 | 暂未实现（使用 prebuilt） |
| `package.json` 中的 scripts | 打包命令 | `package.json` 中的 scripts |
| `.github/workflows/build.yml` | CI/CD 多平台矩阵 | 暂未实现 |
| `dev-app-update.yml` | 自动更新配置 | 暂未实现 |

| 特性 | OpenCowork | Wishful Claw |
|------|-----------|--------------|
| 打包工具 | electron-builder v26 | electron-builder v26 |
| 配置文件 | `electron-builder.yml` | `electron-builder.yml` ✅ 已对齐 |
| .NET Worker 编译 | `scripts/publish-native-worker.mjs`（AOT） | `build:worker:prod` 脚本（AOT）|
| Worker 输出目录 | `resources/native-worker/` | `resources/worker/` |
| asar 解包 | `asarUnpack: ["resources/**"]` | `asarUnpack: ["resources/**"]` ✅ 已对齐 |
| 包体积优化 | 详细的 `files` 排除规则 | 详细的 `files` 排除规则 ✅ 已对齐 |
| 原生模块重建 | `npmRebuild: false` + postinstall | `npmRebuild: false` ✅ 已对齐 |
| 自动更新 | GitHub Releases + electron-updater | 未实现 |
| CI/CD | GitHub Actions 多平台矩阵 | 未实现 |
| 代码签名 | Windows + macOS 签名 | 未配置 |

### 包体积优化参考

OpenCowork 的 `electron-builder.yml` 中 `files` 排除了大量 node_modules 中的源码（已由 Vite 打包），这是减小安装包体积的关键。Wishful Claw 后续可参考此做法优化。

### 跨平台打包参考

OpenCowork 支持 Windows(x64/arm64)、macOS(arm64/x64)、Linux(x64/arm64) 三平台。
Wishful Claw 目前仅支持 Windows x64，后续可参考 OpenCowork 的 CI/CD 配置扩展。

## 常见问题

### Q: electron-builder 报错 "EPERM: operation not permitted"

A: 删除 `release/` 目录后重试：
```bash
rm -rf release/
npm run pack
```

### Q: electron-builder 报错 "MSB8040: 此项目需要缓解了 Spectre 漏洞的库"

A: 在 Visual Studio Installer 中安装 Spectre 缓解库，或使用 `--config.npmRebuild=false` 跳过原生模块重建。

### Q: 打包后运行找不到 Worker

A: 检查 `release/win-unpacked/resources/worker/` 是否存在 `WishfulClaw.Worker.exe`。
如果缺失，先运行 `npm run build:worker:prod` 再重新打包。