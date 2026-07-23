import json

# Update zh/layout.json
with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/layout.json', 'r', encoding='utf-8') as f:
    zh = json.load(f)

if 'splash' not in zh:
    zh['splash'] = {}
zh['splash']['loading'] = '\u6b63\u5728\u8fdb\u5165...'

if 'personaSelect' not in zh['splash']:
    zh['splash']['personaSelect'] = {}
zh['splash']['personaSelect'].update({
    'title': '\u9009\u62e9\u4f60\u7684\u4eba\u683c',
    'subtitle': '\u9009\u62e9\u4e00\u4e2a AI \u4eba\u683c\u4f5c\u4e3a\u4f60\u7684\u9ed8\u8ba4\u52a9\u624b\u3002\u4e0d\u540c\u4eba\u683c\u6709\u4e0d\u540c\u7684\u6027\u683c\u548c\u6c9f\u901a\u98ce\u683c\uff0c\u4e4b\u540e\u53ef\u4ee5\u968f\u65f6\u5207\u6362\u3002',
    'loading': '\u52a0\u8f7d\u4eba\u683c\u5217\u8868...',
    'empty': '\u6682\u65e0\u53ef\u7528\u4eba\u683c',
    'retry': '\u91cd\u8bd5',
    'hint': '\u53ef\u4ee5\u5728\u8bbe\u7f6e\u4e2d\u968f\u65f6\u4fee\u6539\u6216\u521b\u5efa\u65b0\u4eba\u683c',
    'start': '\u5f00\u59cb\u4f7f\u7528',
    'saved': '\u4eba\u683c\u5df2\u8bbe\u7f6e'
})

with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/layout.json', 'w', encoding='utf-8') as f:
    json.dump(zh, f, ensure_ascii=False, indent=2)

# Update en/layout.json
with open('D:/claw/wishful-claw/src/renderer/src/locales/en/layout.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

if 'splash' not in en:
    en['splash'] = {}
en['splash']['loading'] = 'Loading...'

if 'personaSelect' not in en['splash']:
    en['splash']['personaSelect'] = {}
en['splash']['personaSelect'].update({
    'title': 'Choose Your Persona',
    'subtitle': 'Select an AI persona as your default assistant. Different personas have different personalities and communication styles. You can switch anytime.',
    'loading': 'Loading personas...',
    'empty': 'No personas available',
    'retry': 'Retry',
    'hint': 'You can modify or create new personas in Settings anytime',
    'start': 'Get Started',
    'saved': 'Persona set'
})

with open('D:/claw/wishful-claw/src/renderer/src/locales/en/layout.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print('i18n updated for splash')
