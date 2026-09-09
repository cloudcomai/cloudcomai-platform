import { ApiRoute } from './endpoints.js';

export class CloudComAiApi {
  constructor(client) {
    if (!client?.request) throw new TypeError('An ApiClient instance is required');
    this.client = client;
  }

  login(identifier, password, options = {}) {
    return this.client.post(ApiRoute.LOGIN, { identifier, password }, { ...options, auth: false });
  }
  register(input, options = {}) { return this.client.post(ApiRoute.REGISTER, input, { ...options, auth: false }); }
  forgotPassword(identifier, options = {}) { return this.client.post(ApiRoute.FORGOT_PASSWORD, { identifier }, { ...options, auth: false }); }
  resetPassword(token, password, options = {}) { return this.client.post(ApiRoute.RESET_PASSWORD, { token, password }, { ...options, auth: false }); }
  updateProfile(input, options = {}) { return this.client.put(ApiRoute.PROFILE, input, options); }
  getUserProfile(userId, options = {}) { return this.client.get(ApiRoute.USER_PROFILE, { ...options, query: { ...options.query, id: userId } }); }
  listUsers(options = {}) { return this.client.get(ApiRoute.USERS, options); }
  searchUsers(query, options = {}) { return this.client.get(ApiRoute.SEARCH_USERS, { ...options, query: { ...options.query, q: query } }); }
  getPreferences(options = {}) { return this.client.get(ApiRoute.PREFERENCES, options); }
  updatePreferences(interests, options = {}) { return this.client.put(ApiRoute.PREFERENCES, { interests }, options); }
  getPrivacySettings(options = {}) { return this.client.get(ApiRoute.PRIVACY, options); }
  updatePrivacySettings(settings, options = {}) { return this.client.put(ApiRoute.PRIVACY, settings, options); }
  blockContact(userId, options = {}) { return this.client.post(ApiRoute.PRIVACY, { user_id: userId }, options); }
  unblockContact(userId, options = {}) { return this.client.delete(ApiRoute.PRIVACY, { ...options, query: { ...options.query, user_id: userId } }); }
  downloadAccountBackup(options = {}) { return this.client.get(ApiRoute.ACCOUNT_BACKUP, options); }
  listChats(type, options = {}) { return this.client.get(ApiRoute.CHATS, { ...options, query: { ...options.query, type } }); }
  listPublicChats(options = {}) { return this.client.get(ApiRoute.PUBLIC_CHATS, options); }
  joinPublicChat(roomId, options = {}) { return this.client.post(ApiRoute.PUBLIC_CHATS, { room_id: roomId }, options); }
  createPrivateChat(targetUserId, options = {}) { return this.client.post(ApiRoute.CHATS, { type: 'private', target_user_id: targetUserId }, options); }
  deleteChat(id, options = {}) { return this.client.delete(ApiRoute.CHATS, { ...options, query: { ...options.query, id } }); }
  listGroups(options = {}) { return this.client.get(ApiRoute.GROUPS, options); }
  createGroup(input, options = {}) { return this.client.post(ApiRoute.GROUPS, input, options); }
  createGroupInvite(id, options = {}) { return this.client.post(ApiRoute.GROUPS, {}, { ...options, query: { ...options.query, action: 'invite', id } }); }
  previewInvitation(token, options = {}) { return this.client.get(ApiRoute.JOIN, { ...options, auth: false, query: { ...options.query, token } }); }
  acceptInvitation(token, options = {}) { return this.client.post(ApiRoute.JOIN, { token }, options); }
  updateGroup(id, input, options = {}) { return this.client.put(ApiRoute.GROUPS, input, { ...options, query: { ...options.query, id } }); }
  deleteGroup(id, options = {}) { return this.client.delete(ApiRoute.GROUPS, { ...options, query: { ...options.query, id } }); }
  listGroupMembers(chatId, options = {}) { return this.client.get(ApiRoute.GROUP_MEMBERS, { ...options, query: { ...options.query, chat_id: chatId } }); }
  updateGroupMember(chatId, userId, action, options = {}) { return this.client.post(ApiRoute.GROUP_MEMBERS, { chat_id: chatId, user_id: userId, action }, options); }
  listMessages(chatId, afterId = 0, options = {}) { return this.client.get(ApiRoute.MESSAGES, { ...options, query: { ...options.query, chat_id: chatId, after_id: afterId } }); }
  searchMessages(chatId, query, options = {}) { return this.client.get(ApiRoute.MESSAGES, { ...options, query: { ...options.query, chat_id: chatId, after_id: 0, q: query } }); }
  deleteMessage(id, scope = 'self', options = {}) { return this.client.delete(ApiRoute.MESSAGES, { ...options, query: { ...options.query, id, scope } }); }
  sendMessage(input, options = {}) { return this.client.post(ApiRoute.MESSAGES, input, options); }
  editMessage(messageId, body, options = {}) { return this.client.post(ApiRoute.EDIT_MESSAGE, { editing_id: messageId, body }, options); }
  shareLocation(chatId, latitude, longitude, label = 'Shared location', options = {}) { return this.sendMessage({ chat_id: chatId, type: 'location', latitude, longitude, label }, options); }
  createPoll(input, options = {}) { return this.client.post(ApiRoute.POLLS, input, options); }
  voteInPoll(pollId, optionId, options = {}) { return this.client.post(ApiRoute.POLLS, { poll_id: pollId, option_id: optionId }, { ...options, query: { ...options.query, action: 'vote' } }); }
  listContacts(page = 1, pageSize = 500, options = {}) { return this.client.get(ApiRoute.CONTACTS, { ...options, query: { ...options.query, page, page_size: pageSize } }); }
  getGoogleConnect(options = {}) { return this.client.get(ApiRoute.GOOGLE_CONNECT, options); }
  getGoogleStatus(options = {}) { return this.client.get(ApiRoute.GOOGLE_STATUS, options); }
  syncGoogleContacts(options = {}) { return this.client.post(ApiRoute.GOOGLE_SYNC, {}, options); }
  uploadAttachment(formData, options = {}) { return this.client.post(ApiRoute.UPLOAD_ATTACHMENT, formData, options); }
  uploadMedia(formData, options = {}) { return this.client.post(ApiRoute.MEDIA_UPLOAD, formData, options); }
  heartbeat(options = {}) { return this.client.post(ApiRoute.HEARTBEAT, {}, options); }
  registerDeviceToken(input, options = {}) { return this.client.post(ApiRoute.DEVICE_TOKEN, input, options); }
  unregisterDeviceToken(options = {}) { return this.client.delete(ApiRoute.DEVICE_TOKEN, options); }
  listNotifications(options = {}) { return this.client.get(ApiRoute.NOTIFICATIONS, options); }
  markNotificationsRead(input, options = {}) { return this.client.post(ApiRoute.NOTIFICATIONS_READ, input, options); }
  getChatNotificationState(chatId, options = {}) { return this.client.get(ApiRoute.CHAT_NOTIFICATION_STATE, { ...options, query: { ...options.query, chat_id: chatId } }); }
  updateChatNotificationState(chatId, input, options = {}) { return this.client.post(ApiRoute.CHAT_NOTIFICATION_STATE, { chat_id: chatId, ...input }, options); }
  reportScreenshot(chatId, options = {}) { return this.client.post(ApiRoute.SCREENSHOT_EVENT, { chat_id: chatId }, options); }
}

export const createCloudComAiApi = (client) => new CloudComAiApi(client);
