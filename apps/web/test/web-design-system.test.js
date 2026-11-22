import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const styles=readFileSync(new URL('../src/web-design-system.css',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
test('web design tokens load after the existing theme layer',()=>{for(const token of ['--web-surface:','--web-text:','--web-border:','--web-primary:','--web-radius:','--web-shadow:'])assert.ok(styles.includes(token));assert.ok(entry.indexOf("import './global-theme.css';")<entry.indexOf("import './web-design-system.css';"));});
test('Moments has compact layout and responsive feed styling',()=>{for(const selector of ['.moments-header','.moments-layout','.moments-compose-card','.moments-feed-card','.moments-empty'])assert.ok(styles.includes(selector));assert.match(styles,/@media\(max-width:900px\)/);});
test('shared navigation, controls, dialogs, and auth screens use design tokens',()=>{for(const selector of ['.main-sidebar','.sidebar-navigation .nav-item','.app-container input','.modal-backdrop','.auth-card'])assert.ok(styles.includes(selector));});