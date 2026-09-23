import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_THEME_IDS, APP_THEMES, DEFAULT_APP_THEME_ID, resolveAppTheme } from '../src/services/appTheme.js';
const approved={
 'modern-blue':['#0F172A','#2563EB','#3B82F6','#E0E7FF','#10B981'],
 'purple-accent':['#1E1B4B','#7C3AED','#A78BFA','#EDE9FE','#34D399'],
 'teal-green':['#0B2F2A','#14B8A6','#2DD4BF','#E6FFFB','#F59E0B'],
};
test('only approved themes are exposed',()=>assert.deepEqual(APP_THEME_IDS,Object.keys(approved)));
test('blue is default',()=>assert.equal(DEFAULT_APP_THEME_ID,'modern-blue'));
test('theme colors stay inside their palette',()=>{for(const [id,theme] of Object.entries(APP_THEMES)) for(const color of Object.values(theme.colors)) assert.ok(approved[id].includes(color));});
test('invalid theme falls back to blue',()=>assert.equal(resolveAppTheme('bad').id,'modern-blue'));
