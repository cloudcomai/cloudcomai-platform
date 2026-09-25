import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { Alert, AppState } from 'react-native';
import { ApiError, ApiRoute, buildApiUrl as apiBuildUrl, createApiClient, createCloudComAiApi } from '@cloudcomai/api-client';
import { createAuthSessionManager } from '@cloudcomai/auth';
import { attachmentPreviewExtension, buildApiUrl, normalizeUploadAsset } from '../utils/media';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
if (!configuredApiBaseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL is required. Configure it in the local .env file or selected EAS environment.');
export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, '');
const secureStorage = { getItem:key=>SecureStore.getItemAsync(key), setItem:(key,value)=>SecureStore.setItemAsync(key,value), removeItem:key=>SecureStore.deleteItemAsync(key) };
const authSessionManager = createAuthSessionManager({ storage: secureStorage });
const sessionExpirationListeners = new Set();
const restorePromptedEmails = new Set();
let presenceTimer = null; let presenceInFlight = false; let appState = AppState.currentState || 'active'; let appStateSubscription = null;
export const subscribeToSessionExpiration = listener => { sessionExpirationListeners.add(listener); return ()=>sessionExpirationListeners.delete(listener); };
const stopPresenceHeartbeat=()=>{if(presenceTimer!==null)clearInterval(presenceTimer);presenceTimer=null;};
const expireSession=async()=>{stopPresenceHeartbeat();await authSessionManager.clearSession();for(const listener of sessionExpirationListeners)listener();};
export const apiClient=createApiClient({baseUrl:API_BASE_URL,tokenProvider:()=>authSessionManager.getToken(),onUnauthorized:expireSession});
const offerBackupRestore=async session=>{const email=String(session?.user?.email||'').trim().toLowerCase();if(!session?.token||!email||restorePromptedEmails.has(email))return;restorePromptedEmails.add(email);try{const response=await apiClient.get(ApiRoute.ACCOUNT_BACKUP,{auth:true,query:{status:'1'},headers:{Authorization:`Bearer ${session.token}`}});const backup=response?.data?.backup;if(!backup?.restore_available||session.token!==await authSessionManager.getToken())return;Alert.alert('Cloud backup found',`A CloudComAI backup is available for ${email}. Restore it on this device?`,[{text:'Skip',style:'cancel'},{text:'Restore',onPress:async()=>{try{if(session.token!==await authSessionManager.getToken())return;const restored=await apiClient.post(ApiRoute.ACCOUNT_BACKUP,{action:'restore'},{auth:true,headers:{Authorization:`Bearer ${session.token}`}});Alert.alert('Restore completed',`${restored?.data?.restore?.chats||0} chats and ${restored?.data?.restore?.messages||0} messages restored.`);}catch(error){Alert.alert('Restore failed',error?.message||'Unable to restore the cloud backup.');}}}]);}catch{}}
const sendPresenceHeartbeat=async()=>{if(appState!=='active'||presenceInFlight||!(await authSessionManager.getToken()))return;presenceInFlight=true;try{await apiClient.post(ApiRoute.HEARTBEAT,{}, {auth:true});}catch{}finally{presenceInFlight=false;}};
const startPresenceHeartbeat=()=>{if(presenceTimer!==null)return;sendPresenceHeartbeat();presenceTimer=setInterval(sendPresenceHeartbeat,30000);};
const bindPresenceAppState=()=>{if(appStateSubscription)return;appStateSubscription=AppState.addEventListener('change',nextState=>{appState=nextState;if(nextState==='active'){startPresenceHeartbeat();}else{stopPresenceHeartbeat();}});};
bindPresenceAppState();
export const sessionManager={
  getToken:()=>authSessionManager.getToken(),
  getSession:async()=>{const session=await authSessionManager.getSession();if(session?.token&&appState==='active')startPresenceHeartbeat();return session;},
  setSession:async session=>{const result=await authSessionManager.setSession(session);if(session?.token&&appState==='active')startPresenceHeartbeat();else stopPresenceHeartbeat();if(session?.token)void offerBackupRestore(session);return result;},
  clearSession:async()=>{stopPresenceHeartbeat();return authSessionManager.clearSession();},
};
export const platformApi=createCloudComAiApi(apiClient);

const parseUploadResult=async(result,requestToken)=>{let data=null;try{data=result.body?JSON.parse(result.body):null;}catch{if(result.status>=200&&result.status<300)throw new ApiError('The server returned an invalid upload response.',{status:result.status});}if(result.status===401&&requestToken===await sessionManager.getToken())await expireSession();if(result.status<200||result.status>=300)throw new ApiError(data?.error||data?.message||`Upload failed with status ${result.status}`,{status:result.status,code:data?.code||null,details:data});return{data,status:result.status,headers:result.headers};};

const isNativeFileUri = uri => /^(content|file):\/\//i.test(String(uri || ''));
const appendNativeFilePart = (form, fieldName, asset) => {
  const normalized = normalizeUploadAsset(asset,{fallbackName:'attachment'});
  if (isNativeFileUri(normalized.uri)) {
    form.append(fieldName, { uri: normalized.uri, name: normalized.name, type: normalized.mimeType });
    return true;
  }
  return false;
};

// Expo SDK 57 exposes the File constructor as the supported way to create a
// File instance from a URI. File.fromUri() is not part of the installed API.
// Keeping this conversion in one shared helper prevents image/video/audio/file
// uploads from drifting into different URI handling implementations.
const appendExpoFilePart = (form, fieldName, asset) => {
  const normalized = normalizeUploadAsset(asset,{fallbackName:'attachment'});
  if (!isNativeFileUri(normalized.uri)) return false;
  const file = new File(normalized.uri);
  form.append(fieldName, file);
  return true;
};

const mediaSendDiagnostic = (stage, normalized, context = {}) => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const mediaType = String(normalized?.mimeType || '').split('/')[0] || 'unknown';
  console.debug('[MEDIA_SEND]', {
    type: mediaType,
    stage,
    chatType: context.chatType || 'unknown',
    source: normalized?.uri ? String(normalized.uri).split(':')[0] || 'unknown' : 'unknown',
    hasMimeType: Boolean(normalized?.mimeType),
    hasFileName: Boolean(normalized?.name),
    hasFileSize: Number(normalized?.size || 0) > 0,
  });
};

const mediaSendErrorDiagnostic = (error, stage, normalized, context = {}) => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const mediaType = String(normalized?.mimeType || '').split('/')[0] || 'unknown';
  console.debug('[MEDIA_SEND]', {
    type: mediaType,
    stage,
    chatType: context.chatType || 'unknown',
    errorName: error?.name || 'Error',
    errorMessage: String(error?.message || error || 'Unknown error').slice(0, 240),
  });
};

export async function createMobileMultipartBody(asset,{fieldName='file',parameters={},extraFiles={},multipartPartMode='native',diagnosticContext={}}={},FormDataCtor=globalThis.FormData){
  if(typeof FormDataCtor!=='function')throw new ApiError('Multipart upload is unavailable on this device.');
  const normalized=normalizeUploadAsset(asset,{fallbackName:'attachment'});
  mediaSendDiagnostic('asset_normalized',normalized,diagnosticContext);
  const form=new FormDataCtor();
  const appendFilePart = multipartPartMode === 'expo-file' ? appendExpoFilePart : appendNativeFilePart;
  mediaSendDiagnostic('upload_prepare',normalized,diagnosticContext);
  if(!appendFilePart(form,fieldName,normalized)){
    const response=await fetch(normalized.uri);
    if(!response.ok)throw new ApiError(`Unable to read the selected file (status ${response.status}).`);
    const blob=await response.blob();
    const typedBlob=blob.type===normalized.mimeType?blob:blob.slice(0,blob.size,normalized.mimeType);
    form.append(fieldName,typedBlob,normalized.name);
  }
  for(const [key,value] of Object.entries(extraFiles)){
    const file=normalizeUploadAsset(value.asset || value,{fallbackName:value.fallbackName || key,fallbackMime:value.fallbackMime || 'application/octet-stream'});
    if(!appendFilePart(form,key,file)){
      const fileResponse=await fetch(file.uri);
      if(!fileResponse.ok)throw new ApiError(`Unable to read the selected ${key}.`);
      const fileBlob=await fileResponse.blob();
      form.append(key,fileBlob.type===file.mimeType?fileBlob:fileBlob.slice(0,fileBlob.size,file.mimeType),file.name);
    }
  }
  for(const[key,value]of Object.entries(parameters)){if(value!==undefined&&value!==null)form.append(key,String(value));}
  return form;
}

export async function uploadMobileFile(route,asset,{fieldName='file',parameters={},extraFiles={},fallbackName='upload',fallbackMime='application/octet-stream',maxBytes=25*1024*1024,multipartPartMode='native',onProgress,diagnosticContext={}}={}){
  const normalized=normalizeUploadAsset(asset,{fallbackName,fallbackMime});
  mediaSendDiagnostic('asset_normalized',normalized,diagnosticContext);
  let file=null;
  try{file=new File(normalized.uri);}catch(error){mediaSendErrorDiagnostic(error,'file_metadata',normalized,diagnosticContext);}
  if(file && !file.exists && !isNativeFileUri(normalized.uri))throw new ApiError('The selected file is no longer available.');
  const size=Number(file?.size??normalized.size??0);
  if(Number.isFinite(size)&&size>maxBytes)throw new ApiError(`The selected file must be ${Math.floor(maxBytes/1024/1024)} MB or smaller.`);
  if(!Number.isFinite(size)||size<=0){
    if(!normalized.size || normalized.size<=0)throw new ApiError('The selected file is empty or its size could not be determined.');
  }
  const token=await sessionManager.getToken();
  const formData=await createMobileMultipartBody(normalized,{fieldName,parameters:{...parameters,original_filename:parameters.original_filename||normalized.name},extraFiles,multipartPartMode,diagnosticContext});
  mediaSendDiagnostic('upload_started',normalized,diagnosticContext);
  try {
    if(typeof onProgress!=='function'){
      const response=await fetch(buildApiUrl(API_BASE_URL,route),{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:formData});
      const body=await response.text();
      const result=parseUploadResult({status:response.status,body,headers:Object.fromEntries(response.headers.entries())},token);
      mediaSendDiagnostic('upload_finished',normalized,diagnosticContext);
      return result;
    }
    const result=await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('POST',buildApiUrl(API_BASE_URL,route));
      if(token)xhr.setRequestHeader('Authorization',`Bearer ${token}`);
      xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.min(1,event.loaded/event.total));};
      xhr.onload=()=>resolve({status:xhr.status,body:xhr.responseText,headers:{}});
      xhr.onerror=()=>reject(new ApiError('Unable to reach the media upload server. Check your internet connection and API address.'));
      xhr.ontimeout=()=>reject(new ApiError('The media upload timed out. Please try again.'));
      xhr.onabort=()=>reject(new ApiError('The media upload was cancelled.'));
      xhr.timeout=120000;
      xhr.send(formData);
    });
    const parsed=parseUploadResult(result,token);
    mediaSendDiagnostic('upload_finished',normalized,diagnosticContext);
    return parsed;
  } catch(error) {
    mediaSendErrorDiagnostic(error,'upload_failed',normalized,diagnosticContext);
    throw error;
  }
}

const inFlightAttachmentUploads = new WeakMap();
export const uploadAttachmentAsset=(asset,parameters={})=>{
  if (!asset || typeof asset !== 'object') return uploadMobileFile(ApiRoute.UPLOAD_ATTACHMENT,asset,{fieldName:'file',fallbackName:'attachment',parameters});
  const existing = inFlightAttachmentUploads.get(asset);
  if (existing) return existing;
  const {onProgress,extraFiles,diagnosticContext,...formParameters}=parameters;
  const promise=uploadMobileFile(ApiRoute.UPLOAD_ATTACHMENT,asset,{fieldName:'file',fallbackName:'attachment',parameters:{...formParameters,original_filename:normalizeUploadAsset(asset,{fallbackName:'attachment'}).name},multipartPartMode:'expo-file',onProgress,extraFiles,diagnosticContext});
  inFlightAttachmentUploads.set(asset,promise);
  promise.finally(()=>{if(inFlightAttachmentUploads.get(asset)===promise)inFlightAttachmentUploads.delete(asset);}).catch(()=>{});
  return promise;
};
export const uploadMediaAsset=(asset,parameters={})=>uploadMobileFile(ApiRoute.MEDIA_UPLOAD,asset,{fieldName:'image',fallbackName:'profile.jpg',fallbackMime:'image/jpeg',maxBytes:12*1024*1024,multipartPartMode:'expo-file',parameters});
export async function downloadAttachmentPreview(attachment){if(!attachment?.id)throw new ApiError('Attachment preview is unavailable.');const token=await sessionManager.getToken();if(!token)throw new ApiError('Authentication is required to preview this attachment.',{status:401});const directory=new Directory(Paths.cache,'cloudcomai-attachment-previews');directory.create({intermediates:true,idempotent:true});const version=String(attachment.updated_at||attachment.created_at||attachment.file_size||'1').replace(/[^a-z0-9._-]/gi,'_');const file=new File(directory,`${Number(attachment.id)}-${version}.${attachmentPreviewExtension(attachment)}`);if(file.exists&&Number(file.size||0)>0)return file;try{return await File.downloadFileAsync(buildApiUrl(API_BASE_URL,ApiRoute.ATTACHMENT,{id:attachment.id,preview:1}),file,{headers:{Authorization:`Bearer ${token}`}});}catch(error){if(file.exists){try{file.delete();}catch{}}throw error;}}
export async function downloadVideoThumbnail(attachment){if(!attachment?.id)throw new ApiError('Video thumbnail is unavailable.');const token=await sessionManager.getToken();if(!token)throw new ApiError('Authentication is required to preview this video.',{status:401});const directory=new Directory(Paths.cache,'cloudcomai-video-thumbnails');directory.create({intermediates:true,idempotent:true});const file=new File(directory,`${Number(attachment.id)}.jpg`);try{return await File.downloadFileAsync(buildApiUrl(API_BASE_URL,ApiRoute.ATTACHMENT,{id:attachment.id,thumbnail:1}),file,{headers:{Authorization:`Bearer ${token}`}});}catch(error){if(file.exists){try{file.delete();}catch{}}throw error;}}
export const mediaUrl=(type,id,version='')=>{const base=buildApiUrl(API_BASE_URL,ApiRoute.MEDIA||'v1/media',{type,id});return version===''||version===null||version===undefined?base:`${base}&v=${encodeURIComponent(String(version))}`;};
