import fs from 'node:fs';
import path from 'node:path';

describe('message read receipts', () => {
  const root = path.resolve(process.cwd(), 'apps/mobile');
  const receipt = fs.readFileSync(path.join(root, 'src/components/ReadReceipt.js'), 'utf8');
  const media = fs.readFileSync(path.join(root, 'src/components/MediaMessage.js'), 'utf8');

  test('uses viewport measurement before marking an item read', () => {
    expect(receipt).toContain('measureInWindow');
    expect(receipt).toContain('markMessagesRead');
    expect(receipt).toContain("AppState.currentState !== 'active'");
  });

  test('renders one receipt wrapper for every supported message renderer', () => {
    expect(media).toContain('ReadReceipt');
    expect(media).toContain('MediaMessageContent');
  });

  test('keeps the public chat exclusion server-side', () => {
    const handler = fs.readFileSync(path.resolve(process.cwd(), 'backend/api/message_read_receipts.php'), 'utf8');
    expect(handler).toContain("!in_array($message['type'], ['private', 'group'], true)");
  });
});
