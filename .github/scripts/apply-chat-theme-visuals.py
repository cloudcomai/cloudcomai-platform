from pathlib import Path
p = Path('apps/mobile/App.js')
s = p.read_text()
if 'wallpaperUri' in s and 'baseTheme = resolveChatTheme' in s:
    raise SystemExit(0)

def replace(old, new, count=1):
    global s
    if s.count(old) < count:
        raise SystemExit(f'Expected {count}, found {s.count(old)}: {old[:100]}')
    s = s.replace(old, new, count)

replace("  const theme = resolveChatTheme(themeSettings, Appearance.getColorScheme());", "  const baseTheme = resolveChatTheme(themeSettings, Appearance.getColorScheme());\n  const customAccent = themeSettings?.accentColor || baseTheme.colors.accent;\n  const theme = { ...baseTheme, colors: { ...baseTheme.colors, accent: customAccent, outgoing: themeSettings?.accentColor || baseTheme.colors.outgoing } };")
replace("<SafeAreaView style={[styles.appPage, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom', 'left', 'right']}>", "<SafeAreaView style={[styles.appPage, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom', 'left', 'right']}>\n      {themeSettings?.wallpaperUri ? <Image pointerEvents=\"none\" source={{ uri: themeSettings.wallpaperUri }} style={[StyleSheet.absoluteFillObject, { opacity: Math.max(0.2, Math.min(1, 1 - Number(themeSettings.wallpaperOpacity ?? 0.35))) }]} /> : null}", 1)
p.write_text(s)
