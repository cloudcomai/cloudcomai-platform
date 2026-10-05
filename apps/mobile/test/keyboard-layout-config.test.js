import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf8'));

test('Android resizes the app window when the software keyboard opens', () => {
  assert.equal(config.expo?.android?.softwareKeyboardLayoutMode, 'resize');
});
