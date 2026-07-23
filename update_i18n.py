import json

# Update zh/settings.json
with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/settings.json', 'r', encoding='utf-8') as f:
    zh = json.load(f)

zh['tabs']['persona'] = {
    'label': '\u4eba\u683c\u7ba1\u7406',
    'desc': '\u7ba1\u7406\u4eba\u683c\u5e93\uff0c\u7f16\u8f91\u8eab\u4efd\u3001\u7075\u9b42\u3001\u8ba4\u77e5\u548c\u884c\u4e3a\u51c6\u5219'
}

zh['persona'] = {
    'title': '\u4eba\u683c\u7ba1\u7406',
    'subtitle': '\u7ba1\u7406\u5168\u5c40\u4eba\u683c\u5e93\uff0c\u7f16\u8f91\u4eba\u683c\u7684\u8eab\u4efd\u3001\u7075\u9b42\u3001\u8ba4\u77e5\u548c\u884c\u4e3a\u51c6\u5219',
    'newPersona': '\u65b0\u5efa\u4eba\u683c',
    'builtin': '\u5185\u7f6e',
    'newBadge': '\u65b0\u5efa',
    'empty': '\u6682\u65e0\u4eba\u683c',
    'selectHint': '\u4ece\u5de6\u4fa7\u9009\u62e9\u4e00\u4e2a\u4eba\u683c\uff0c\u6216\u70b9\u51fb\u300c\u65b0\u5efa\u4eba\u683c\u300d',
    'unsaved': '\u672a\u4fdd\u5b58',
    'unsavedConfirm': '\u6709\u672a\u4fdd\u5b58\u7684\u66f4\u6539\uff0c\u786e\u5b9a\u5207\u6362\u5417\uff1f',
    'fieldName': '\u540d\u79f0',
    'fieldTagline': '\u6807\u8bed',
    'fieldDescription': '\u63cf\u8ff0',
    'namePlaceholder': '\u4eba\u683c\u540d\u79f0',
    'taglinePlaceholder': '\u4e00\u53e5\u8bdd\u63cf\u8ff0',
    'descriptionPlaceholder': '\u66f4\u8be6\u7ec6\u7684\u63cf\u8ff0',
    'editorPlaceholder': '\u5728\u6b64\u7f16\u5199 Markdown \u5185\u5bb9...',
    'save': '\u4fdd\u5b58',
    'reset': '\u91cd\u7f6e',
    'delete': '\u5220\u9664',
    'cancel': '\u53d6\u6d88',
    'confirmDelete': '\u5220\u9664',
    'deleteConfirmTitle': '\u5220\u9664\u4eba\u683c',
    'deleteConfirmDesc': '\u786e\u5b9a\u8981\u5220\u9664\u300c{{name}}\u300d\u5417\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002',
    'dismiss': '\u5173\u95ed',
    'saved': '\u4eba\u683c\u5df2\u4fdd\u5b58',
    'deleted': '\u4eba\u683c\u5df2\u5220\u9664',
    'saveFailed': '\u4fdd\u5b58\u5931\u8d25',
    'deleteFailed': '\u5220\u9664\u5931\u8d25'
}

with open('D:/claw/wishful-claw/src/renderer/src/locales/zh/settings.json', 'w', encoding='utf-8') as f:
    json.dump(zh, f, ensure_ascii=False, indent=2)

# Update en/settings.json
with open('D:/claw/wishful-claw/src/renderer/src/locales/en/settings.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

en['tabs']['persona'] = {
    'label': 'Persona',
    'desc': 'Manage persona library, edit identity, soul, ontology and behavior rules'
}

en['persona'] = {
    'title': 'Persona Management',
    'subtitle': 'Manage global persona library, edit identity, soul, ontology and behavior rules',
    'newPersona': 'New Persona',
    'builtin': 'Built-in',
    'newBadge': 'New',
    'empty': 'No personas',
    'selectHint': 'Select a persona from the left, or click New Persona',
    'unsaved': 'Unsaved',
    'unsavedConfirm': 'You have unsaved changes. Are you sure you want to switch?',
    'fieldName': 'Name',
    'fieldTagline': 'Tagline',
    'fieldDescription': 'Description',
    'namePlaceholder': 'Persona name',
    'taglinePlaceholder': 'One-line description',
    'descriptionPlaceholder': 'More detailed description',
    'editorPlaceholder': 'Write Markdown content here...',
    'save': 'Save',
    'reset': 'Reset',
    'delete': 'Delete',
    'cancel': 'Cancel',
    'confirmDelete': 'Delete',
    'deleteConfirmTitle': 'Delete Persona',
    'deleteConfirmDesc': 'Are you sure you want to delete {{name}}? This action cannot be undone.',
    'dismiss': 'Dismiss',
    'saved': 'Persona saved',
    'deleted': 'Persona deleted',
    'saveFailed': 'Failed to save',
    'deleteFailed': 'Failed to delete'
}

with open('D:/claw/wishful-claw/src/renderer/src/locales/en/settings.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)

print('i18n updated successfully')
