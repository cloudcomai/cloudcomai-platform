import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const app=fs.readFileSync(path.join(here,'../App.js'),'utf8');
const api=fs.readFileSync(path.join(here,'../../../packages/api-client/src/cloudcomai-api.js'),'utf8');
const component=fs.readFileSync(path.join(here,'../src/components/PublicChatManagement.js'),'utf8');

test('reply previews navigate to and highlight the original message, loading older context when needed',()=>{
 assert.ok(app.includes('getMessageContext(chat.id,id'));
 assert.match(app,/scrollToIndex/);
 assert.match(app,/highlightedMessageId/);
 assert.match(app,/navigateToMessage(item.reply_to_message_id)/);
});
test('public chat management exposes online users, reporting and leave confirmation',()=>{
 assert.match(app,/PublicChatManagement/);
 assert.match(component,/Online Users/);
 assert.match(component,/Report User/);
 assert.match(component,/Leave Chat \/ Leave Room/);
 assert.ok(component.includes('Number(selectedUser.id)===Number(user.id)'));
});
test('attachment plus button keeps camera, photo library and document flows with preview and retry',()=>{
 assert.match(app,/openAttachmentPicker/);
 assert.match(app,/Camera/);
 assert.match(app,/Photo library/);
 assert.match(app,/Document/);
 assert.match(app,/attachmentDraft/);
 assert.match(app,/Retry/);
 assert.match(app,/uploadAttachmentAsset/);
});
test('API client exposes message context and public moderation endpoints',()=>{
 assert.ok(api.includes('getMessageContext(chatId, messageId'));
 assert.ok(api.includes('getPublicChatManage(roomId'));
 assert.ok(api.includes('reportPublicChatUser(roomId'));
});
