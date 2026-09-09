from pathlib import Path
p=Path('apps/mobile/App.js')
s=p.read_text()
old="  }, [showNotificationSettings, showPrivacySettings]);"
new="  }, [showNotificationSettings, showPrivacySettings, showChatThemeSettings]);"
if old not in s:
    raise SystemExit('Expected settings BackHandler dependency list was not found')
p.write_text(s.replace(old,new,1))
