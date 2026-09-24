import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAT_THEME_IDS, CHAT_THEMES, DEFAULT_CHAT_THEME_ID, resolveChatTheme } from '../src/services/chatThemeDefinitions.js';

const approved = {
  'modern-blue': ['#0877D1','#075FA8','#EAF5FF','#F7FAFC','#FFFFFF','#F0F6FB','#102A43','#52667A','#718096','#D7E3EF','#E7EEF5','#138A5B'],
  'teal-green': ['#0F8F83','#0B6B63','#E6FFFB','#F5FBFA','#FFFFFF','#EDF8F6','#12302C','#4E6B66','#718783','#CFE5E1','#E0EFEC','#0C7A4D'],
  'purple-accent': ['#6D3FD1','#5730AE','#F3EEFF','#FAF8FE','#FFFFFF','#F5F1FC','#241A3A','#675C78','#827895','#DDD3EE','#ECE6F5','#15835E'],
  midnight: ['#4DA3FF','#2D7DCC','#173A5F','#0B1220','#111B2E','#16233A','#F3F7FC','#B6C3D6','#8C9BB2','#2B3B54','#22314A','#35C98A'],
};

test('all supported global themes are exposed in the intended order', () => assert.deepEqual(CHAT_THEME_IDS, Object.keys(approved)));
test('CloudCom Blue is the default', () => assert.equal(DEFAULT_CHAT_THEME_ID, 'modern-blue'));
test('every theme uses only approved accessible palette values', () => {
  for (const [id, theme] of Object.entries(CHAT_THEMES)) {
    for (const color of Object.values(theme.colors)) assert.ok(approved[id].includes(color) || ['#FFFFFF','#137333','#A15C00','#B42318','#A0AEC0','#A5B8B4','#B2A9C0','#5F6F86','#4CCB7A','#F4B860','#FF7A7A'].includes(color), `${id} contains unexpected ${color}`);
  }
});
test('every theme defines the required contrast tokens', () => {
  for (const theme of Object.values(CHAT_THEMES)) {
    for (const key of ['textPrimary','textSecondary','textMuted','textOnPrimary','placeholder','disabled','border','divider','incoming','outgoing','composer','modalBackground','modalText']) assert.ok(theme.colors[key], `${theme.id} is missing ${key}`);
  }
});
test('unknown theme resolves to CloudCom Blue', () => assert.equal(resolveChatTheme({ id: 'unknown' }).id, 'modern-blue'));
