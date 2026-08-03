"""Add SSH i18n entries to zh/en settings.json"""
import json
import pathlib

# ── SSH i18n entries ──

SSH_ZH = {
    "title": "SSH 连接",
    "description": "管理 SSH 服务器连接，用于远程命令执行",
    "add": "添加连接",
    "empty": "暂无 SSH 连接，点击「添加连接」创建",
    "test": "测试连接",
    "edit": "编辑",
    "delete": "删除",
    "createTitle": "新建 SSH 连接",
    "editTitle": "编辑 SSH 连接",
    "cancel": "取消",
    "save": "保存",
    "create": "创建",
    "fields": {
        "name": "名称",
        "host": "主机地址",
        "port": "端口",
        "username": "用户名",
        "authType": "认证方式",
        "password": "密码",
        "privateKey": "密钥",
        "agent": "SSH Agent",
        "keyPath": "密钥路径",
        "passphrase": "密钥口令",
        "leaveBlank": "留空保持不变",
        "defaultDir": "默认目录"
    }
}

SSH_EN = {
    "title": "SSH Connections",
    "description": "Manage SSH server connections for remote command execution.",
    "add": "Add Connection",
    "empty": "No SSH connections yet. Click \"Add Connection\" to create one.",
    "test": "Test connection",
    "edit": "Edit",
    "delete": "Delete",
    "createTitle": "New SSH Connection",
    "editTitle": "Edit SSH Connection",
    "cancel": "Cancel",
    "save": "Save",
    "create": "Create",
    "fields": {
        "name": "Name",
        "host": "Host",
        "port": "Port",
        "username": "Username",
        "authType": "Authentication",
        "password": "Password",
        "privateKey": "Private Key",
        "agent": "SSH Agent",
        "keyPath": "Private Key Path",
        "passphrase": "Passphrase",
        "leaveBlank": "leave blank to keep",
        "defaultDir": "Default Directory"
    }
}

# ── Update zh ──
zh_path = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\locales\zh\settings.json")
zh = json.loads(zh_path.read_text(encoding="utf-8"))
zh["ssh"] = SSH_ZH
zh["tabs"]["ssh"] = {"label": "SSH 连接", "desc": "管理远程服务器 SSH 连接"}
zh_path.write_text(json.dumps(zh, ensure_ascii=False, indent="  ") + "\n", encoding="utf-8")
print("zh updated")

# ── Update en ──
en_path = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\locales\en\settings.json")
en = json.loads(en_path.read_text(encoding="utf-8"))
en["ssh"] = SSH_EN
en["tabs"]["ssh"] = {"label": "SSH", "desc": "Manage remote server SSH connections"}
en_path.write_text(json.dumps(en, ensure_ascii=False, indent="  ") + "\n", encoding="utf-8")
print("en updated")
