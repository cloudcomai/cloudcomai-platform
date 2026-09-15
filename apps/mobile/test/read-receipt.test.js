import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(process.cwd(), 'apps/mobile');
const receipt = fs.readFileSync(path.join(root, 'src/components/ReadReceipt.js'), 'utf8');
const media = fs.readFileSync(path.join(root, 'src/components/MediaMessage.js'), 'utf8');
const handler = fs.readFileSync(path.resolve(process.cwd(), 'backend/api/message_read_receipts.php'), 'utf8');

test('uses viewport measurement before marking an item read', () => {
  assert.match(receipt, /measureInWindow/);
  assert.match(receipt, /markMessagesRead/);
  assert.match(receipt, /AppState\.currentState !== 'active'/);
});

test('renders one receipt wrapper for every supported message renderer', () => {
  assert.match(media, /ReadReceipt/);
  assert.match(media, /MediaMessageContent/);
});

test('keeps the public chat exclusion server-side', () => {
  assert.match(handler, /!in_array\(\$message\['type'\], \['private', 'group'\], true\)/);
  assert.match(handler, /'eligible' => false/);
});
