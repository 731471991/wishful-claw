"""Add preview-related i18n keys to en/zh layout.json"""
import json
import pathlib

entries = {
    'en': {
        'rightPanel.openFile': 'Open file',
        'rightPanel.preview': 'Preview',
        'rightPanel.previewEmpty': 'No preview content',
        'preview.openFile': 'Open file',
        'preview.preview': 'Preview',
        'preview.code': 'Code',
        'preview.modified': 'Modified',
        'preview.copied': 'Copied',
        'preview.noViewer': 'No viewer available for this file type',
        'preview.openInSystem': 'Open in system',
        'preview.unsavedChanges': 'Unsaved changes',
        'preview.unsavedChangesDesc': '{fileName} has unsaved changes. Do you want to save before closing?',
        'preview.discard': 'Discard',
        'preview.diffSplit': 'Split',
        'preview.diffInline': 'Inline',
    },
    'zh': {
        'rightPanel.openFile': '\u6253\u5f00\u6587\u4ef6',
        'rightPanel.preview': '\u9884\u89c8',
        'rightPanel.previewEmpty': '\u65e0\u9884\u89c8\u5185\u5bb9',
        'preview.openFile': '\u6253\u5f00\u6587\u4ef6',
        'preview.preview': '\u9884\u89c8',
        'preview.code': '\u4ee3\u7801',
        'preview.modified': '\u5df2\u4fee\u6539',
        'preview.copied': '\u5df2\u590d\u5236',
        'preview.noViewer': '\u6b64\u6587\u4ef6\u7c7b\u578b\u65e0\u53ef\u7528\u67e5\u770b\u5668',
        'preview.openInSystem': '\u5728\u7cfb\u7edf\u4e2d\u6253\u5f00',
        'preview.unsavedChanges': '\u672a\u4fdd\u5b58\u7684\u66f4\u6539',
        'preview.unsavedChangesDesc': '{fileName} \u6709\u672a\u4fdd\u5b58\u7684\u66f4\u6539\u3002\u5173\u95ed\u524d\u8981\u4fdd\u5b58\u5417\uff1f',
        'preview.discard': '\u4e22\u5f03',
        'preview.diffSplit': '\u5206\u5c4f',
        'preview.diffInline': '\u5185\u8054',
    }
}

for lang, vals in entries.items():
    p = pathlib.Path(f'src/renderer/src/locales/{lang}/layout.json')
    data = json.loads(p.read_text(encoding='utf-8-sig'))
    if 'rightPanel' not in data:
        data['rightPanel'] = {}
    if 'preview' not in data:
        data['preview'] = {}
    for key, val in vals.items():
        section, subkey = key.split('.', 1)
        if section not in data:
            data[section] = {}
        data[section][subkey] = val
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Updated {lang}/layout.json')
