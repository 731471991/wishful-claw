#!/usr/bin/env python3
"""Add missing i18n keys to zh and en settings.json, then fix GeneralPanel.tsx"""
import json
import os

BASE = r"D:\claw\wishful-claw\src\renderer\src\locales"

# ─── zh/settings.json ───
zh_path = os.path.join(BASE, "zh", "settings.json")
with open(zh_path, "r", encoding="utf-8") as f:
    zh = json.load(f)

zh["general"]["language"] = {
    "label": "语言 / Language",
    "desc": "界面显示语言"
}
zh["general"]["toolExecution"] = {
    "label": "工具执行",
    "desc": "控制 Agent 可同时运行和每轮调用的工具数量",
    "maxParallel": {
        "label": "最大并行工具数",
        "desc": "同时执行的工具数量"
    },
    "maxPerTurn": {
        "label": "每轮最大工具调用数",
        "desc": "单次 AI 回复中工具调用的上限"
    }
}
zh["general"]["developerMode"] = {
    "label": "开发者模式",
    "desc": "显示每条助手消息的请求参数（URL、请求头、请求体），便于开发调试",
    "enabled": "已启用",
    "disabled": "已禁用"
}
zh["general"]["reset"] = "重置"

with open(zh_path, "w", encoding="utf-8") as f:
    json.dump(zh, f, ensure_ascii=False, indent=2)

# ─── en/settings.json ───
en_path = os.path.join(BASE, "en", "settings.json")
with open(en_path, "r", encoding="utf-8") as f:
    en = json.load(f)

en["general"]["language"] = {
    "label": "Language",
    "desc": "Interface display language"
}
en["general"]["toolExecution"] = {
    "label": "Tool Execution",
    "desc": "Control how many tools the agent can run at once and per turn",
    "maxParallel": {
        "label": "Max Parallel Tools",
        "desc": "Number of tools executed simultaneously"
    },
    "maxPerTurn": {
        "label": "Max Tool Calls Per Turn",
        "desc": "Cap total tool calls in a single AI response"
    }
}
en["general"]["developerMode"] = {
    "label": "Developer Mode",
    "desc": "Show request parameters (URL, headers, body) for each assistant message. Useful for debugging during development.",
    "enabled": "Enabled",
    "disabled": "Disabled"
}
en["general"]["reset"] = "Reset"

with open(en_path, "w", encoding="utf-8") as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print("Done: i18n keys added to zh and en settings.json")
