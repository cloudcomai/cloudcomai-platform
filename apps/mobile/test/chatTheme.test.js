import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAT_THEME_IDS, CHAT_THEMES, DEFAULT_CHAT_THEME_ID, resolveChatTheme } from '../src/services/chatThemeDefinitions.js';

const approved = {
  'modern-blue':['#0F172A','#2563EB','#3B82F6','#E0E7FF','#10B981'],
  'purple-accent':['#1E1B4B','#7C3AED','#A78BFA','#EDE9FE','#34D399'],
  'teal-green':['#0B2F2A','#14B8A6','#2DD4BF','#E6FFFB','#F59E0B'],
};
test('only approved app themes are exposed',()=>assert.deepEqual(CHAT_THEME_IDS,Object.keys(approved)));
test('modern blue is the default',()=>assert.equal(DEFAULT_CHAT_THEME_ID,'modern-blue'));
test('every theme uses only its approved palette',()=>{ for(const [id,theme] of Object.entries(CHAT_THEMES)){ for(const color of Object.values(theme.colors)) assert.ok(approved[id].includes(color), id+' contains unapproved '+color); } });
test('unknown theme resolves to modern blue',()=>assert.equal(resolveChatTheme({id:'unknown'}).id,'modern-blue'));
