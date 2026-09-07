import React, { useEffect, useRef, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { parseSharedLocation } from '@cloudcomai/chat-core';
import { Users, BarChart3, Search, MoreHorizontal, Reply, Edit3, Plus, X, Send, Link2, Trash2, Pin, Share2, Copy } from 'lucide-react';
import { formatMessageTime } from '../utils/messageTime';
import { copyText, shareOrCopyLink } from '../utils/shareLink';
import AttachmentControls from './AttachmentControls';
import AttachmentActions from './AttachmentActions';
import AttachmentPreview from './AttachmentPreview';
import MediaMessageControls from './MediaMessageControls';

const pollCardStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', minWidth: '280px', maxWidth: '70%', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '4px' };
const pollHeaderStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' };
const pollTitleStyle = { fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', margin: 0 };
const pollOptionsStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };
const pollOptionStyle = { position: 'relative', background: 'var(--bg-directory)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', cursor: 'pointer', overflow: 'hidden', textAlign: 'left', width: '100%' };
const pollFooterStyle = { marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-light)' };
const senderNameStyle = { fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '5px', paddingLeft: '3px' };
const replyPreviewStyle = { borderLeft: '3px solid var(--primary-color)', background: 'var(--bg-directory)', borderRadius: '7px', padding: '7px 9px', marginBottom: '8px', fontSize: '11px', lineHeight: '1.35', color: 'var(--text-muted)', maxWidth: '100%' };
const replySenderStyle = { fontWeight: '700', color: 'var(--text-main)', marginBottom: '2px' };
const attachmentMessageStyle = { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px', maxWidth: '360px' };
const attachmentActionRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: '28px' };
const attachmentMetaStyle = { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 };
const attachmentIconStyle = { fontSize: '24px', flex: '0 0 auto' };
const attachmentNameStyle = { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const attachmentDetailsStyle = { fontSize: '11px', color: 'var(--text-muted)' };

export default function ChatCanvas({ selectedChat, messages, user, setModal, replyTo, setReplyTo, editing, setEditing, composer, setComposer, onSendMessage, apiBridge, onDeleteChat, onDeleteGroup, onGroupInvite, onAttachmentUploaded, onDeleteMessage, mediaAutoDownload = false }) {
  const historyRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const [groupActionMessage, setGroupActionMessage] = useState('');
  const [groupInviteUrl, setGroupInviteUrl] = useState('');
  const [preparingInvite, setPreparingInvite] = useState(false);
  const [pollVoteState, setPollVoteState] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [chatMuted, setChatMuted] = useState(Boolean(selectedChat?.notifications_muted));
  const [emojiOpen, setEmojiOpen] = useState(false);
  const searchActive = searchOpen && searchQuery.trim().length > 0;
  const visibleMessages = searchActive ? searchResults : messages;

  useEffect(() => {
    setChatMuted(Boolean(selectedChat?.notifications_muted));
    if (selectedChat?.id) apiBridge('v1/notifications/chat-state', { method: 'POST', body: JSON.stringify({ chat_id: selectedChat.id, mark_read: true }) }).catch(() => {});
    setSearchOpen(false); setSearchQuery(''); setSearchResults([]); setDeleteTarget(null); setSelectedMessageId(null);
    shouldAutoScrollRef.current = true;
  }, [selectedChat?.id]);

  useEffect(() => {
    if (!searchActive || !selectedChat) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    setSearchStatus('Searching…');
    const timer = setTimeout(async () => {
      try {
        const result = await apiBridge(ApiRoute.MESSAGES, { method: 'GET', query: { chat_id: selectedChat.id, q: searchQuery.trim() }, signal: controller.signal });
        if (!cancelled) { setSearchResults(result.messages || []); setSearchStatus(`${result.messages?.length || 0} results (up to 100)`); }
      } catch (error) { if (!cancelled) { setSearchResults([]); setSearchStatus(error.message || 'Search failed.'); } }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [selectedChat?.id, searchQuery, searchActive, messages]);

  const deleteMessage = async scope => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await onDeleteMessage(deleteTarget, scope);
      setSearchResults(current => current.filter(item => Number(item.id) !== Number(deleteTarget.id)));
      if (Number(replyTo?.id) === Number(deleteTarget.id)) setReplyTo(null);
      if (Number(editing?.id) === Number(deleteTarget.id)) { setEditing(null); setComposer(''); }
      setDeleteTarget(null);
    } catch (error) { alert(error.message || 'Unable to delete message.'); }
    finally { setDeleting(false); }
  };

  useEffect(() => {
    const viewport = historyRef.current;
    if (!viewport || searchActive || !shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => { viewport.scrollTop = viewport.scrollHeight; });
  }, [selectedChat?.id, messages.length]);

  useEffect(() => { setGroupActionMessage(''); setGroupInviteUrl(''); setPollVoteState({}); }, [selectedChat?.id]);

  const handleHistoryScroll = () => {
    const viewport = historyRef.current;
    if (!viewport) return;
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 100;
  };

  const handleCastVote = async (pollId, optionId) => {
    if (!apiBridge || !pollId || !optionId) return;
    try {
      const response = await apiBridge(ApiRoute.POLLS, { method: 'POST', query: { action: 'vote' }, body: JSON.stringify({ poll_id: Number(pollId), option_id: Number(optionId) }) });
      if (response?.options) setPollVoteState(prev => ({ ...prev, [pollId]: response.options }));
    } catch (err) { alert(err.message || 'Failed to submit vote.'); }
  };

  const isGroup = selectedChat?.type === 'group' || selectedChat?.isGroup;
  const isGroupOwner = isGroup && Number(selectedChat?.owner_id) === Number(user?.id);

  const prepareGroupInvite = async () => {
    if (!onGroupInvite || preparingInvite) return;
    setPreparingInvite(true);
    setGroupActionMessage('');
    try {
      const response = await onGroupInvite(selectedChat);
      if (!response?.invite_url) throw new Error('The server did not return an invitation link.');
      setGroupInviteUrl(response.invite_url);
      setGroupActionMessage('Invitation ready. Share it or copy the link below.');
    } catch (error) {
      setGroupActionMessage(error.message || 'Unable to generate group link');
    } finally {
      setPreparingInvite(false);
    }
  };

  const shareInvite = async () => {
    try {
      const result = await shareOrCopyLink({
        title: `Join ${selectedChat.name} on CloudComAI`,
        text: `You are invited to join ${selectedChat.name} on CloudComAI.`,
        url: groupInviteUrl,
      });
      if (result !== 'cancelled') setGroupActionMessage(result === 'shared' ? 'Invitation shared.' : 'Invitation link copied.');
    } catch (error) { setGroupActionMessage(error.message || 'Unable to share invitation.'); }
  };

  const copyInvite = async () => {
    try { await copyText(groupInviteUrl); setGroupActionMessage('Invitation link copied.'); }
    catch (error) { setGroupActionMessage(error.message || 'Unable to copy invitation.'); }
  };

  return (
    <main className="chat-interaction-canvas">
      <header className="canvas-header-nav">
        {selectedChat ? (
          <div className="active-interlocutor-card">
            <div className="avatar-frame small">
              {selectedChat.image_url ? <img src={`${selectedChat.image_url}&v=${selectedChat.image_version || ''}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <div className="avatar-placeholder">{selectedChat.name ? selectedChat.name[0] : '?'}</div>}
            </div>
            <div className="interlocutor-details"><h4>{selectedChat.name}</h4><p className="presence-subtext">{isGroup ? 'Group' : selectedChat.online ? 'Online' : 'Offline'}</p></div>
          </div>
        ) : <div className="active-interlocutor-card"><h4>Select a conversation to begin</h4></div>}

        <div className="canvas-action-utilities">
          {/* Audio and video calls are temporarily hidden until their functionality is completed. */}
          {/* <button className="action-utility-btn" onClick={() => setModal('audio')}><span>Audio Call</span></button> */}
          {/* <button className="action-utility-btn" onClick={() => setModal('video')}><span>Video Call</span></button> */}
          <button className="action-utility-btn" onClick={() => setModal('poll')}><BarChart3 size={18}/><span>New Poll</span></button>
          {/* Location sharing is temporarily hidden until its functionality is completed. */}

          {isGroup ? <>
            <button className="action-utility-btn" style={{ color: '#10b981' }} onClick={() => setModal('add_member')}><Plus size={16}/><span>Add Member</span></button>
            <button className="action-utility-btn" onClick={() => setModal('manage_members')}><Users size={16}/><span>Manage</span></button>
            {isGroupOwner && <>
              <button className="action-utility-btn" onClick={() => setModal('edit_group')}><Edit3 size={16}/><span>Edit Group</span></button>
              <button className="action-utility-btn" onClick={prepareGroupInvite} disabled={preparingInvite}><Link2 size={16}/><span>{preparingInvite ? 'Preparing...' : 'Invite People'}</span></button>
              <button className="action-utility-btn text-red" style={{ color: '#ef4444' }} onClick={() => onDeleteGroup(selectedChat)}><Trash2 size={18}/><span>Delete Group</span></button>
            </>}
          </> : <>
            <button className="action-utility-btn" onClick={() => setModal('group')}><Users size={18}/><span>New Group</span></button>
            {selectedChat && <button className="action-utility-btn" style={{ color: '#ef4444' }} onClick={() => onDeleteChat(selectedChat)}><Trash2 size={18}/><span>Delete Chat</span></button>}
          </>}

          {selectedChat && <button className="action-utility-btn" onClick={async () => { const next = !chatMuted; try { await apiBridge('v1/notifications/chat-state', { method: 'POST', body: JSON.stringify({ chat_id: selectedChat.id, muted: next }) }); setChatMuted(next); } catch (error) { alert(error.message || 'Unable to update mute setting.'); } }}><span>{chatMuted ? '🔕 Unmute' : '🔔 Mute'}</span></button>}
          <div className="vertical-divider" /><button className="icon-utility-only" disabled={!selectedChat} aria-label="Search messages" title="Search messages" onClick={() => setSearchOpen(value => !value)}><Search size={18}/></button>
        </div>
      </header>
      {searchOpen && <div className="chat-search-bar"><Search size={18} /><input autoFocus aria-label="Search this conversation" placeholder="Search messages and filenames…" maxLength={120} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /><span role="status">{searchActive ? searchStatus : 'Search this conversation'}</span><button aria-label="Close search" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}><X size={18} /></button></div>}

      {(groupActionMessage || groupInviteUrl) && <div className="group-invite-bar">
        {groupActionMessage && <span>{groupActionMessage}</span>}
        {groupInviteUrl && <>
          <input value={groupInviteUrl} readOnly aria-label="Group invitation link" />
          <button type="button" onClick={shareInvite}><Share2 size={15} /> Share</button>
          <button type="button" onClick={copyInvite}><Copy size={15} /> Copy</button>
        </>}
      </div>}

      <div className="message-history-viewport" ref={historyRef} onScroll={handleHistoryScroll}>
        {selectedChat?.blocked && <div className="chat-status-note">Messaging is unavailable for this blocked contact. Manage your blocked contacts in Privacy &amp; Account.</div>}

        {visibleMessages.map(msg => {
          const isMine = msg.sender_id == user?.id || msg.user_id == user?.id || msg.mine === true;
          const isPoll = msg.type === 'poll';
          const isAttachment = Boolean(msg.attachment);
          const location = msg.type === 'location' ? parseSharedLocation(msg.body) : null;
          const messageContent = msg.body || msg.text || '';
          const poll = msg.poll;
          const visibleOptions = pollVoteState[msg.poll_id] || poll?.options || [];
          const messageTime = formatMessageTime(msg.created_at || msg.timestamp || msg.time);
          const senderLabel = isGroup ? (isMine ? 'You' : (msg.sender_name || 'Member')) : null;
          const attachmentIsImage = isAttachment && String(msg.attachment.mime_type || '').startsWith('image/');

          const selected = Number(selectedMessageId) === Number(msg.id);
          return <div key={msg.id} className={`message-bubble-wrapper ${isMine ? 'outgoing-align' : 'incoming-align'} ${selected ? 'message-selected' : ''}`} onClick={() => setSelectedMessageId(current => Number(current) === Number(msg.id) ? null : msg.id)}>
            {isPoll ? <div className="poll-bubble-card" style={pollCardStyle}>
              {senderLabel && <div style={senderNameStyle}>{senderLabel}</div>}
              <div style={pollHeaderStyle}><span style={{ fontSize: '18px' }}>📊</span><h4 style={pollTitleStyle}>{poll?.question || 'Poll'}</h4></div>
              <div style={pollOptionsStyle}>{visibleOptions.map(option => <button key={option.id} type="button" onClick={() => handleCastVote(msg.poll_id || poll?.id, option.id)} style={pollOptionStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span>{option.text}</span><strong>{option.votes || 0}</strong></div>{option.selected && <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--primary-color)' }}>Your vote</div>}</button>)}</div>
              <div className="bubble-meta-footer" style={pollFooterStyle}><span>Active Voting Room</span><span>{messageTime}</span></div>
              <button className="message-delete-btn" onClick={() => setDeleteTarget(msg)} aria-label="Delete message"><Trash2 size={14} /> Delete</button>
            </div> : <div className={`message-data-bubble ${isMine ? 'primary-accent' : 'neutral-fallback'}`}>
              {senderLabel && <div style={senderNameStyle}>{senderLabel}</div>}
              {msg.reply_to_message_id && msg.reply_to_text && <div style={replyPreviewStyle}>
                <div style={replySenderStyle}><Reply size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{msg.reply_to_sender_name || 'Member'}</div>
                <div>{msg.reply_to_text}</div>
              </div>}
              {msg.reply_to_text && !msg.reply_to_message_id && <div style={replyPreviewStyle}>
                <div style={replySenderStyle}><Reply size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{msg.reply_to_sender_name || 'Member'}</div>
                <div>{msg.reply_to_text}</div>
              </div>}
              {isAttachment ? <div style={attachmentMessageStyle}>
                <div style={attachmentActionRowStyle}>
                  <AttachmentActions attachment={msg.attachment} message={msg} user={user} apiBridge={apiBridge} />
                </div>

                <AttachmentPreview attachment={msg.attachment} messageType={msg.type} autoDownload={mediaAutoDownload} />

                <div style={attachmentMetaStyle}>
                  {!attachmentIsImage && <span style={attachmentIconStyle}>📎</span>}
                  <div style={{ minWidth: 0 }}>
                    <div style={attachmentNameStyle}>{msg.attachment.name}</div>
                    <div style={attachmentDetailsStyle}>
                      {Math.ceil(Number(msg.attachment.file_size || 0) / 1024)} KB · {msg.attachment.download_policy === 'VIEW_ONLY' ? 'View only' : msg.attachment.download_policy === 'ALLOW' ? 'Download allowed' : 'Approval required'}
                    </div>
                  </div>
                </div>
              </div> : location ? <a className="shared-location-card" href={location.url} target="_blank" rel="noopener noreferrer"><strong>📍 {location.label}</strong><span>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span><span>Open in maps ↗</span></a> : <p className="bubble-text-content">{msg.type === 'location' ? 'Location unavailable' : messageContent}</p>}
              <div className="bubble-meta-footer"><span className="bubble-time">{messageTime}</span>{msg.edited && <span className="edited-flag">· Edited</span>}</div>
              {selected && <div className="bubble-action-triggers selected-actions" onClick={event => event.stopPropagation()}><button onClick={() => { setReplyTo(msg); setSelectedMessageId(null); }} title="Reply" aria-label="Reply"><Reply size={12} /> Reply</button>{isMine && msg.type === 'text' && <button onClick={() => { setEditing(msg); setComposer(messageContent); setSelectedMessageId(null); }} title="Edit" aria-label="Edit message"><Edit3 size={12} /> Edit</button>}<button onClick={() => { setDeleteTarget(msg); setSelectedMessageId(null); }} title="Delete" aria-label="Delete message"><Trash2 size={12} /> Delete</button></div>}
            </div>}
          </div>;
        })}
      </div>

      <div className="canvas-bottom-action-tray">
        <div className="shortcut-action-grid">
          {/* Status, Stories, and Live Location shortcuts are temporarily hidden until their functionality is completed. */}
          <button className="shortcut-action-card yellow-theme" onClick={() => setModal('poll')}><div className="shortcut-icon-circle"><BarChart3 size={18}/></div><div className="shortcut-meta"><h5>Polls</h5><p>Create polls</p></div></button>
        </div>

        {replyTo || editing ? <div className="context-bar"><div>{editing ? 'Editing Message' : 'Replying to'}: <strong>{(editing || replyTo).body || (editing || replyTo).text}</strong></div><button onClick={() => { setReplyTo(null); setEditing(null); setComposer(''); }}><X size={16}/></button></div> : null}
        {emojiOpen && <div className="emoji-picker-row"><button type="button" key="😀" onClick={() => setComposer(value => `${value}😀`)}>😀</button><button type="button" key="😂" onClick={() => setComposer(value => `${value}😂`)}>😂</button><button type="button" key="😍" onClick={() => setComposer(value => `${value}😍`)}>😍</button><button type="button" key="😊" onClick={() => setComposer(value => `${value}😊`)}>😊</button><button type="button" key="👍" onClick={() => setComposer(value => `${value}👍`)}>👍</button><button type="button" key="🙏" onClick={() => setComposer(value => `${value}🙏`)}>🙏</button><button type="button" key="❤️" onClick={() => setComposer(value => `${value}❤️`)}>❤️</button><button type="button" key="🎉" onClick={() => setComposer(value => `${value}🎉`)}>🎉</button><button type="button" key="😢" onClick={() => setComposer(value => `${value}😢`)}>😢</button><button type="button" key="😡" onClick={() => setComposer(value => `${value}😡`)}>😡</button><button type="button" key="🤔" onClick={() => setComposer(value => `${value}🤔`)}>🤔</button><button type="button" key="👏" onClick={() => setComposer(value => `${value}👏`)}>👏</button></div>}
        <div className="message-input-composer-bar">
          <button type="button" className="emoji-toggle-btn" onClick={() => setEmojiOpen(value => !value)} aria-label="Choose emoji">☺</button>
          <AttachmentControls selectedChat={selectedChat} apiBridge={apiBridge} onUploaded={onAttachmentUploaded} /><MediaMessageControls key={selectedChat?.id} selectedChat={selectedChat} apiBridge={apiBridge} onUploaded={onAttachmentUploaded} />
          <input type="text" aria-label="Message" placeholder={selectedChat ? 'Type a message...' : 'Select a conversation to start messaging'} value={composer} onChange={e => setComposer(e.target.value)} onKeyDown={e => e.key === 'Enter' && !selectedChat?.blocked && onSendMessage()} disabled={!selectedChat || selectedChat.blocked} className="composer-text-input" />
          <button className="voice-mic-submit-btn" onClick={onSendMessage} disabled={!selectedChat || selectedChat.blocked} aria-label="Send message"><Send size={18} /></button>
        </div>
      </div>
      {deleteTarget && <div className="modal-overlay"><div className="modal-content-card message-delete-dialog" role="dialog" aria-modal="true" aria-label="Delete message"><h3>Delete message?</h3><p>Delete for me removes it from your account. Only the sender can delete it for everyone.</p><button disabled={deleting} onClick={() => deleteMessage('self')}>Delete for me</button>{Number(deleteTarget.sender_id) === Number(user?.id) && <button className="danger" disabled={deleting} onClick={() => deleteMessage('everyone')}>Delete for everyone</button>}<button disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button></div></div>}
    </main>
  );
}
