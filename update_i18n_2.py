import json

# Update zh/settings.json - add project persona keys
with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/settings.json', 'r', encoding='utf-8') as f:
    zh = json.load(f)

zh['persona']['projectTitle'] = '\u9879\u76ee\u4eba\u683c\u7ba1\u7406'
zh['persona']['projectSubtitle'] = '\u7ba1\u7406\u9879\u76ee\u4eba\u683c\u5e93\uff0c\u72ec\u7acb\u4e8e\u5168\u5c40\u4eba\u683c\u5e93'
zh['persona']['copyFromGlobal'] = '\u4ece\u5168\u5c40\u590d\u5236'

with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/settings.json', 'w', encoding='utf-8') as f:
    json.dump(zh, f, ensure_ascii=False, indent=2)

# Update en/settings.json
with open('D:/claw/wishful-claw/src/renderer/src/locales/en/settings.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

en['persona']['projectTitle'] = 'Project Persona Management'
en['persona']['projectSubtitle'] = 'Manage project persona library, independent from global library'
en['persona']['copyFromGlobal'] = 'Copy from Global'

with open('D:/claw/wishful-claw/src/renderer/src/locales/en/settings.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

# Update zh/chat.json - add openPersona key
with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/chat.json', 'r', encoding='utf-8') as f:
    zh_chat = json.load(f)

if 'projectHome' not in zh_chat:
    zh_chat['projectHome'] = {}
zh_chat['projectHome']['openPersona'] = '\u4eba\u683c\u7ba1\u7406'

with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/chat.json', 'w', encoding='utf-8') as f:
    json.dump(zh_chat, f, ensure_ascii=False, indent=2)

# Update en/chat.json
with open('D:/claw/wishful-claw/src/renderer/src/locales/en/chat.json', 'r', encoding='utf-8') as f:
    en_chat = json.load(f)

if 'projectHome' not in en_chat:
    en_chat['projectHome'] = {}
en_chat['projectHome']['openPersona'] = 'Persona'

with open('D:/claw/wishful-claw/src/renderer/src/locales/en/chat.json', 'w', encoding='utf-8') as f:
    json.dump(en_chat, f, ensure_ascii=False, indent=2)

# Update zh/layout.json - add title.persona
with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/layout.json', 'r', encoding='utf-8') as f:
    zh_layout = json.load(f)

if 'title' not in zh_layout:
    zh_layout['title'] = {}
zh_layout['title']['persona'] = '\u4eba\u683c\u7ba1\u7406'

with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/layout.json', 'w', encoding='utf-8') as f:
    json.dump(zh_layout, f, ensure_ascii=False, indent=2)

# Update en/layout.json
with open('D:/claw/wishful-claw/src/renderer/src/locales/en/layout.json', 'r', encoding='utf-8') as f:
    en_layout = json.load(f)

if 'title' not in en_layout:
    en_layout['title'] = {}
en_layout['title']['persona'] = 'Persona'

with open('D:/claw/wishful-claw/src/renderer/src/locales/en/layout.json', 'w', encoding='utf-8') as f:
    json.dump(en_layout, f, ensure_ascii=False, indent=2)

print('All i18n files updated')
