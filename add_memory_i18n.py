import json

# English
with open(r'F:\claw\wishful-claw\src\renderer\src\locales\en\layout.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

en['memory'] = {
    "title": "Memory",
    "tabActivity": "Activity",
    "tabMemory": "Memory",
    "hot": "Hot",
    "warm": "Warm",
    "cold": "Cold",
    "searchPlaceholder": "Search memory...",
    "search": "Search",
    "searching": "...",
    "matches": "{{count}} matches",
    "noResults": "No matching memory entries found.",
    "idle": "Search memory or use memory tools in chat.",
    "loading": "Loading...",
    "consolidate": "Consolidate memory index",
    "tier": {
        "hot": "hot",
        "warm": "warm",
        "cold": "cold"
    },
    "scope": {
        "global": "global",
        "project": "project"
    }
}

with open(r'F:\claw\wishful-claw\src\renderer\src\locales\en\layout.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, indent=2, ensure_ascii=False)

# Chinese
with open(r'F:\claw\wishful-claw\src\renderer\src\locales\zh\layout.json', 'r', encoding='utf-8') as f:
    zh = json.load(f)

zh['memory'] = {
    "title": "记忆",
    "tabActivity": "执行",
    "tabMemory": "记忆",
    "hot": "热记忆",
    "warm": "温记忆",
    "cold": "冷记忆",
    "searchPlaceholder": "搜索记忆...",
    "search": "搜索",
    "searching": "...",
    "matches": "{{count}} 条匹配",
    "noResults": "未找到匹配的记忆条目。",
    "idle": "搜索记忆或在对话中使用记忆工具。",
    "loading": "加载中...",
    "consolidate": "整合记忆索引",
    "tier": {
        "hot": "热",
        "warm": "温",
        "cold": "冷"
    },
    "scope": {
        "global": "全局",
        "project": "项目"
    }
}

with open(r'F:\claw\wishful-claw\src\renderer\src\locales\zh\layout.json', 'w', encoding='utf-8') as f:
    json.dump(zh, f, indent=2, ensure_ascii=False)

print("Done: memory i18n added to en + zh layout.json")
