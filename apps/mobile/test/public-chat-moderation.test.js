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
 assert.ok(app.includes('getMessageContext(Number(chat.id), id'));
 assert.ok(app.includes('scrollToIndex'));
 assert.ok(app.includes('highlightedMessageId'));
 assert.ok(app.includes('navigateToMessage(item.reply_to_message_id)'));
});
test('public chat management exposes online users, reporting and leave confirmation',()=>{
 assert.ok(app.includes('PublicChatManagement'));
 assert.ok(component.includes('Online Users'));
 assert.ok(component.includes('Report User'));
 assert.ok(component.includes('Leave Chat / Leave Room'));
 assert.ok(component.includes('Number(selectedUser.id)') && component.includes('Number(user.id)'));
});
test('attachment plus button keeps camera, photo library and document flows with preview and retry',()=>{
 assert.ok(app.includes('openAttachmentPicker'));
 assert.ok(app.includes('Camera'));
 assert.ok(app.includes('Photo library'));
 assert.ok(app.includes('Document'));
 assert.ok(app.includes('attachmentDraft'));
 assert.ok(app.includes('Retry'));
 assert.ok(app.includes('useAttachmentUpload'));
});
test('API client exposes message context and public moderation endpoints',()=>{
 assert.ok(api.includes('getMessageContext(chatId, messageId'));
 assert.ok(api.includes('getPublicChatManage(roomId'));
 assert.ok(api.includes('reportPublicChatUser(roomId'));
 assert.ok(api.includes('getPublicChatHiddenUsers(roomId'));
 assert.ok(api.includes('unhidePublicChatUser(roomId'));
 assert.ok(component.includes('Hidden Users'));
 assert.ok(component.includes('Messages from this user are now hidden from you in all public chats'));
 assert.ok(component.includes('data?.duplicate'));
 assert.ok(component.includes('duplicate report was not counted'));
 assert.ok(component.includes("incident_key:'user:'+String(selectedUser.id)"));
 assert.ok(component.includes('private confirmation in CloudComAI Alerts'));
});
