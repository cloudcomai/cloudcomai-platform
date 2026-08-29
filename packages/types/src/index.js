export const ChatType = Object.freeze({
  PRIVATE: 'private',
  GROUP: 'group',
  PUBLIC: 'public',
  COMMUNITY: 'community',
});

export const ChatMemberRole = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
  READ_ONLY: 'readonly',
});

export const MessageType = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image',
  DOCUMENT: 'document',
  POLL: 'poll',
});

export const AttachmentDownloadPolicy = Object.freeze({
  ALLOW: 'ALLOW',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  VIEW_ONLY: 'VIEW_ONLY',
});

export const AttachmentRequestStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
});

export const AccountStatus = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
});

/** @typedef {{id:number,user_id:string|null,name:string,email:string|null,mobile:string|null,gender:'Male'|'Female',account_status:'active'|'suspended'|'deleted',online?:(boolean|number)}} User */
/** @typedef {{id:number,display_name:string|null,given_name:string|null,family_name:string|null,email:string|null,phone:string|null,photo_url:string|null}} Contact */
/** @typedef {{id:number,type:'private'|'group'|'public'|'community',name:string|null,group_category?:string|null,owner_id?:number|null,retention_seconds?:number|null,created_at?:string,last_message_at?:string|null}} Chat */
/** @typedef {{id:number,message_id:number,original_filename:string,mime_type:string,file_size:number,download_policy:'ALLOW'|'APPROVAL_REQUIRED'|'VIEW_ONLY',request_status?:'PENDING'|'APPROVED'|'DENIED'|null}} Attachment */
/** @typedef {{id:number,text:string,votes?:number,selected?:(boolean|number)}} PollOption */
/** @typedef {{id:number,question:string,options:PollOption[],multiple_choice?:boolean,anonymous?:boolean}} Poll */
/** @typedef {{id:number,chat_id:number,sender_id:number,type:string,body:string|null,reply_to_message_id:number|null,reply_to_text?:string|null,reply_to_sender_name?:string|null,sender_name?:string,edit_count?:number,edited_at?:string|null,created_at:string,attachments?:Attachment[],poll?:Poll|null}} Message */
/** @typedef {{token:string,user:User}} AuthSession */

export const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
