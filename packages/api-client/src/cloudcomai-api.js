import { ApiEndpoint } from './endpoints.js';

export class CloudComAiApi {
  constructor(client) {
    if (!client?.request) throw new TypeError('An ApiClient instance is required');
    this.client = client;
  }

  login(identifier, password, options = {}) {
    return this.client.post(
      ApiEndpoint.LOGIN,
      { identifier, password },
      { ...options, auth: false },
    );
  }

  register(input, options = {}) {
    return this.client.post(ApiEndpoint.REGISTER, input, { ...options, auth: false });
  }

  forgotPassword(identifier, options = {}) {
    return this.client.post(
      ApiEndpoint.FORGOT_PASSWORD,
      { identifier },
      { ...options, auth: false },
    );
  }

  resetPassword(token, password, options = {}) {
    return this.client.post(
      ApiEndpoint.RESET_PASSWORD,
      { token, password },
      { ...options, auth: false },
    );
  }

  updateProfile(input, options = {}) {
    return this.client.put(ApiEndpoint.PROFILE, input, options);
  }

  listUsers(options = {}) {
    return this.client.get(ApiEndpoint.USERS, options);
  }

  searchUsers(query, options = {}) {
    return this.client.get(ApiEndpoint.SEARCH_USERS, {
      ...options,
      query: { ...options.query, q: query },
    });
  }

  listChats(type, options = {}) {
    return this.client.get(ApiEndpoint.CHATS, {
      ...options,
      query: { ...options.query, type },
    });
  }

  createPrivateChat(targetUserId, options = {}) {
    return this.client.post(
      ApiEndpoint.CHATS,
      { type: 'private', target_user_id: targetUserId },
      options,
    );
  }

  listGroups(options = {}) {
    return this.client.get(ApiEndpoint.GROUPS, options);
  }

  createGroup(input, options = {}) {
    return this.client.post(ApiEndpoint.GROUPS, input, options);
  }

  updateGroup(id, input, options = {}) {
    return this.client.put(ApiEndpoint.GROUPS, input, {
      ...options,
      query: { ...options.query, id },
    });
  }

  deleteGroup(id, options = {}) {
    return this.client.delete(ApiEndpoint.GROUPS, {
      ...options,
      query: { ...options.query, id },
    });
  }

  listMessages(chatId, afterId = 0, options = {}) {
    return this.client.get(ApiEndpoint.MESSAGES, {
      ...options,
      query: { ...options.query, chat_id: chatId, after_id: afterId },
    });
  }

  sendMessage(input, options = {}) {
    return this.client.post(ApiEndpoint.MESSAGES, input, options);
  }

  createPoll(input, options = {}) {
    return this.client.post(ApiEndpoint.POLLS, input, options);
  }

  voteInPoll(pollId, optionId, options = {}) {
    return this.client.post(
      ApiEndpoint.POLLS,
      { poll_id: pollId, option_id: optionId },
      { ...options, query: { ...options.query, action: 'vote' } },
    );
  }

  listContacts(page = 1, pageSize = 500, options = {}) {
    return this.client.get(ApiEndpoint.CONTACTS, {
      ...options,
      query: { ...options.query, page, page_size: pageSize },
    });
  }

  getGoogleStatus(options = {}) {
    return this.client.get(ApiEndpoint.GOOGLE_STATUS, options);
  }

  syncGoogleContacts(options = {}) {
    return this.client.post(ApiEndpoint.GOOGLE_SYNC, {}, options);
  }

  uploadAttachment(formData, options = {}) {
    return this.client.post(ApiEndpoint.UPLOAD_ATTACHMENT, formData, options);
  }

  heartbeat(options = {}) {
    return this.client.post(ApiEndpoint.HEARTBEAT, {}, options);
  }
}

export const createCloudComAiApi = (client) => new CloudComAiApi(client);
