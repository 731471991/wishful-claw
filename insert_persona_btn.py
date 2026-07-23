import sys

path = 'D:/claw/wishful-claw/src/renderer/src/components/chat/ProjectHomePage.tsx'
content = open(path, 'r', encoding='utf-8').read()

old = "                {t('projectHome.openGit')}\n              </Button>\n            </div>"

new = """                {t('projectHome.openGit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-md border border-border/60 bg-background/50 px-3 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                onClick={() => useUIStore.getState().navigateToPersona(activeProject.id)}
              >
                <User className="size-3.5" />
                {t('projectHome.openPersona', { defaultValue: '\u4eba\u683c\u7ba1\u7406' })}
              </Button>
            </div>"""

if old in content:
    content = content.replace(old, new, 1)
    open(path, 'w', encoding='utf-8').write(content)
    print('OK - replaced')
else:
    print('NOT FOUND')
    # Show what's around the area
    idx = content.find("openGit")
    if idx >= 0:
        print(repr(content[idx:idx+200]))
