/**
 * Windows system settings & tools entries for the quick launcher.
 *
 * Single data table — kept as one file per the "no forced splitting for
 * homogeneous data" convention.
 *
 * Ported from ZTools v3.1.0 (D:\claw\ZTools-main\src\main\core\systemSettings),
 * an open-source uTools-like launcher. Sources:
 * - https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings
 * - https://ss64.com/nt/syntax-settings.html
 *
 * "清空回收站" was intentionally dropped (needs a confirm dialog we don't have).
 */

export interface WindowsSystemSetting {
  name: string
  /** Launch target: ms-settings URI, shell: path, exe name or command line. */
  command: string
  category: string
}

const MS_SETTINGS_URIS: Array<[string, string, string]> = [
  // === 系统 ===
  ['屏幕', 'ms-settings:display', '系统'],
  ['高级显示设置', 'ms-settings:display-advanced', '系统'],
  ['显示卡', 'ms-settings:display-advancedgraphics', '系统'],
  ['夜间模式', 'ms-settings:nightlight', '系统'],
  ['声音', 'ms-settings:sound', '系统'],
  ['所有声音设备', 'ms-settings:sound-devices', '系统'],
  ['麦克风属性', 'ms-settings:sound-defaultinputproperties', '系统'],
  ['扬声器属性', 'ms-settings:sound-defaultoutputproperties', '系统'],
  ['音量合成器', 'ms-settings:apps-volume', '系统'],
  ['通知', 'ms-settings:notifications', '系统'],
  ['专注', 'ms-settings:quiethours', '系统'],
  ['电源和电池', 'ms-settings:powersleep', '系统'],
  ['电源', 'ms-settings:batterysaver', '系统'],
  ['节能建议', 'ms-settings:energyrecommendations', '系统'],
  ['存储', 'ms-settings:storagesense', '系统'],
  ['存储感知', 'ms-settings:storagepolicies', '系统'],
  ['清理建议', 'ms-settings:storagerecommendations', '系统'],
  ['磁盘和卷', 'ms-settings:disksandvolumes', '系统'],
  ['保存新内容的地方', 'ms-settings:savelocations', '系统'],
  ['多任务处理', 'ms-settings:multitasking', '系统'],
  ['投影到此电脑', 'ms-settings:project', '系统'],
  ['就近共享', 'ms-settings:crossdevice', '系统'],
  ['任务栏', 'ms-settings:taskbar', '个性化'],
  ['剪贴板', 'ms-settings:clipboard', '系统'],
  ['远程桌面', 'ms-settings:remotedesktop', '系统'],
  ['设备加密', 'ms-settings:deviceencryption', '系统'],
  ['关于', 'ms-settings:about', '系统'],

  // === 蓝牙和其他设备 ===
  ['蓝牙', 'ms-settings:bluetooth', '设备'],
  ['设备', 'ms-settings:connecteddevices', '设备'],
  ['投放', 'ms-settings-connectabledevices:devicediscovery', '设备'],
  ['打印机和扫描仪', 'ms-settings:printers', '设备'],
  ['鼠标', 'ms-settings:mousetouchpad', '设备'],
  ['USB', 'ms-settings:usb', '设备'],
  ['摄像头', 'ms-settings:camera', '设备'],

  // === 网络和 Internet ===
  ['网络和 Internet', 'ms-settings:network-status', '网络'],
  ['WLAN', 'ms-settings:network-wifi', '网络'],
  ['管理已知网络', 'ms-settings:network-wifisettings', '网络'],
  ['以太网', 'ms-settings:network-ethernet', '网络'],
  ['VPN', 'ms-settings:network-vpn', '网络'],
  ['代理', 'ms-settings:network-proxy', '网络'],
  ['飞行模式', 'ms-settings:network-airplanemode', '网络'],
  ['移动热点', 'ms-settings:network-mobilehotspot', '网络'],
  ['数据使用量', 'ms-settings:datausage', '网络'],

  // === 个性化 ===
  ['个性化', 'ms-settings:personalization', '个性化'],
  ['背景', 'ms-settings:personalization-background', '个性化'],
  ['颜色', 'ms-settings:personalization-colors', '个性化'],
  ['锁屏界面', 'ms-settings:lockscreen', '个性化'],
  ['主题', 'ms-settings:themes', '个性化'],
  ['字体', 'ms-settings:fonts', '个性化'],
  ['开始', 'ms-settings:personalization-start', '个性化'],

  // === 应用 ===
  ['已安装的应用', 'ms-settings:appsfeatures', '应用'],
  ['默认应用', 'ms-settings:defaultapps', '应用'],
  ['启动', 'ms-settings:startupapps', '应用'],
  ['可选功能', 'ms-settings:optionalfeatures', '应用'],

  // === 账户 ===
  ['你的信息', 'ms-settings:yourinfo', '账户'],
  ['电子邮件和账户', 'ms-settings:emailandaccounts', '账户'],
  ['登录选项', 'ms-settings:signinoptions', '账户'],
  ['其他用户', 'ms-settings:otherusers', '账户'],
  ['Windows 备份', 'ms-settings:sync', '账户'],

  // === 时间和语言 ===
  ['日期和时间', 'ms-settings:dateandtime', '时间'],
  ['语言和区域', 'ms-settings:regionlanguage', '语言'],
  ['区域格式', 'ms-settings:regionformatting', '语言'],
  ['键盘', 'ms-settings:keyboard', '语言'],
  ['高级键盘设置', 'ms-settings:keyboard-advanced', '语言'],
  ['输入', 'ms-settings:typing', '语言'],
  ['语音', 'ms-settings:speech', '语言'],

  // === 隐私和安全性 ===
  ['隐私和安全性', 'ms-settings:privacy', '隐私'],
  ['常规', 'ms-settings:privacy-general', '隐私'],
  ['位置', 'ms-settings:privacy-location', '隐私'],
  ['相机', 'ms-settings:privacy-webcam', '隐私'],
  ['麦克风', 'ms-settings:privacy-microphone', '隐私'],

  // === Windows 更新 ===
  ['Windows 更新', 'ms-settings:windowsupdate', '更新'],
  ['检查更新', 'ms-settings:windowsupdate-action', '更新'],
  ['更新历史记录', 'ms-settings:windowsupdate-history', '更新'],
  ['可选更新', 'ms-settings:windowsupdate-optionalupdates', '更新'],
  ['高级选项', 'ms-settings:windowsupdate-options', '更新'],
  ['重启选项', 'ms-settings:windowsupdate-restartoptions', '更新'],
  ['获取最新更新', 'ms-settings:windowsupdate-seekerondemand', '更新'],
  ['传递优化', 'ms-settings:delivery-optimization', '更新'],
  ['Windows 安全中心', 'ms-settings:windowsdefender', '安全'],
  ['疑难解答', 'ms-settings:troubleshoot', '系统'],
  ['恢复', 'ms-settings:recovery', '系统'],
  ['激活', 'ms-settings:activation', '系统'],
  ['查找我的设备', 'ms-settings:findmydevice', '安全'],
  ['开发者选项', 'ms-settings:developers', '系统'],

  // === 搜索 ===
  ['搜索 Windows', 'ms-settings:search', '搜索'],
  ['搜索权限', 'ms-settings:search-permissions', '搜索']
]

/** 控制面板 + 管理工具 + 常用系统工具 + 高级功能. */
const CONTROL_PANEL_AND_TOOLS: Array<[string, string, string]> = [
  // 控制面板
  ['编辑用户环境变量', 'rundll32 sysdm.cpl,EditEnvironmentVariables', '系统'],
  ['编辑系统环境变量', 'SystemPropertiesAdvanced.exe', '系统'],
  ['系统属性', 'SystemPropertiesAdvanced.exe', '系统'],
  ['计算机名', 'SystemPropertiesComputerName.exe', '系统'],
  ['系统保护', 'SystemPropertiesProtection.exe', '系统'],
  ['远程设置', 'SystemPropertiesRemote.exe', '系统'],
  ['程序和功能', 'appwiz.cpl', '应用'],
  ['鼠标属性', 'main.cpl', '设备'],
  ['网络连接', 'ncpa.cpl', '网络'],
  ['电源选项', 'powercfg.cpl', '系统'],
  ['防火墙', 'firewall.cpl', '安全'],
  ['用户账户', 'netplwiz.exe', '账户'],
  ['日期和时间(控制面板)', 'timedate.cpl', '时间'],

  // 管理工具
  ['设备管理器', 'devmgmt.msc', '管理'],
  ['磁盘管理', 'diskmgmt.msc', '管理'],
  ['计算机管理', 'compmgmt.msc', '管理'],
  ['服务', 'services.msc', '管理'],
  ['任务管理器', 'taskmgr.exe', '系统'],
  ['注册表编辑器', 'regedit.exe', '系统'],
  ['事件查看器', 'eventvwr.msc', '管理'],
  ['任务计划程序', 'taskschd.msc', '管理'],
  ['性能监视器', 'perfmon.msc', '管理'],
  ['资源监视器', 'resmon.exe', '系统'],
  ['组策略编辑器', 'gpedit.msc', '管理'],
  ['本地安全策略', 'secpol.msc', '安全'],

  // 常用系统工具
  ['回收站', 'shell:RecycleBinFolder', '系统'],
  ['命令提示符', 'cmd.exe', '系统'],
  ['PowerShell', 'powershell.exe', '系统'],
  ['Windows Terminal', 'wt.exe', '系统'],
  ['记事本', 'notepad.exe', '应用'],
  ['计算器', 'calc.exe', '应用'],
  ['画图', 'mspaint.exe', '应用'],
  ['截图工具', 'snippingtool.exe', '应用'],
  ['放大镜工具', 'magnify.exe', '辅助'],
  ['字符映射表', 'charmap.exe', '应用'],
  ['远程桌面连接', 'mstsc.exe', '系统'],
  ['系统配置', 'msconfig.exe', '系统'],
  ['磁盘清理', 'cleanmgr.exe', '系统'],
  ['磁盘碎片整理', 'dfrgui.exe', '系统'],
  ['系统信息工具', 'msinfo32.exe', '系统'],
  ['步骤记录器', 'psr.exe', '系统'],

  // 高级功能
  ['键盘属性', 'control.exe keyboard', '设备'],
  ['声音属性', 'mmsys.cpl', '系统'],
  ['添加打印机', 'printui.exe', '设备'],
  ['系统还原', 'rstrui.exe', '系统'],
  ['DirectX 诊断工具', 'dxdiag.exe', '系统'],
  ['程序兼容性助手', 'msdt.exe -id PCWDiagnostic', '系统'],
  ['内存诊断工具', 'MdSched.exe', '系统'],
  ['Windows 功能', 'optionalfeatures.exe', '系统'],
  ['打开运行', 'rundll32 shell32.dll,#61', '系统'],
  ['关于 Windows', 'winver.exe', '系统']
]

export const WINDOWS_SETTINGS: WindowsSystemSetting[] = [...MS_SETTINGS_URIS, ...CONTROL_PANEL_AND_TOOLS].map(
  ([name, command, category]) => ({ name, command, category })
)
