import { ApiRoute } from './endpoints.js';

export class CloudComAiApi {
  constructor(client) {
    if (!client?.request) throw new TypeError('An ApiClient instance is required');
    this.client = client;
  }

  login(identifier, password, options = {}) {
    return this.client.post(
      ApiRoute.LOGIN,
      { identifier, password },
      { ...options, auth: false },
    );
  }

  register(input, options = {}) {
    return this.client.post(ApiRoute.REGISTER, input, { ...options, auth: false });
  }

  forgotPassword(identifier, options = {}) {
    return this.client.post(
      ApiRoute.FORGOT_PASSWORD,
      { identifier },
      { ...options, auth: false },
    );
  }

  resetPassword(token, password, options = {}) {
    return this.client.post(
      ApiRoute.RESET_PASSWORD,
      { token, password },
      { ...options, auth: false },
    );
  }

  updateProfile(input, options = {}) {
    return this.client.put(ApiRoute.PROFILE, input, options);
  }

  listUsers(options = {}) {
    return this.client.get(ApiRoute.USERS, options);
  }

  searchUsers(query, options = {}) {
    return this.client.get(ApiRoute.SEARCH_USERS, {
      ...options,
      query: { ...options.query, q: query },
    });
  }

  listChats(type, options = {}) {
    return this.client.get(ApiRoute.CHATS, {
      ...options,
      query: { ...options.query, type },
    });
  }

  createPrivateChat(targetUserId, options = {}) {
    return this.client.post(
      ApiRoute.CHATS,
      { type: 'private', target_user_id: targetUserId },
      options,
    );
  }

  listGroups(options = {}) {
    return this.client.get(ApiRoute.GROUPS, options);
  }

  createGroup(input, options = {}) {
    return this.client.post(ApiRoute.GROUPS, input, options);
  }

  updateGroup(id, input, options = {}) {
    return this.client.put(ApiRoute.GROUPS, input, {
      ...options,
      query: { ...options.query, id },
    });
  }

  deleteGroup(id, options = {}) {
    return this.client.delete(ApiRoute.GROUPS, {
      ...options,
      query: { ...options.query, id },
    });
  }

  listMessages(chatId, afterId = 0, options = {}) {
    return this.client.get(ApiRoute.MESSAGES, {
      ...options,
      query: { ...options.query, chat_id: chatId, after_id: afterId },
    });
  }

  sendMessage(input, options = {}) {
    return this.client.post(ApiRoute.MESSAGES, input, options);
  }

  createPoll(input, options = {}) {
    return this.client.post(ApiRoute.POLLS, input, options);
  }

  voteInPoll(pollId, optionId, options = {}) {
    return this.client.post(
      ApiRoute.POLLS,
      { poll_id: pollId, option_id: optionId },
      { ...options, query: { ...options.query, action: 'vote' } },
    );
  }

  listContacts(page = 1, pageSize = 500, options = {}) {
    return this.client.get(ApiRoute.CONTACTS, {
      ...options,
      query: { ...options.query, page, page_size: pageSize },
    });
  }

  getGoogleStatus(options = {}) {
    return this.client.get(ApiRoute.GOOGLE_STATUS, options);
  }

  syncGoogleContacts(options = {}) {
    return this.client.post(ApiRoute.GOOGLE_SYNC, {}, options);
  }

  uploadAttachment(formData, options = {}) {
    return this.client.post(ApiRoute.UPLOAD_ATTACHMENT, formData, options);
  }

  uploadMedia(formData, options = {}) {
    return this.client.post(ApiRoute.MEDIA_UPLOAD, formData, options);
  }

  heartbeat(options = {}) {
    return this.client.post(ApiRoute.HEARTBEAT, {}, options);
  }
}

export const createCloudComAiApi = (client) => new CloudComAiApi(client);
