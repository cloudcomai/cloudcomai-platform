import React, { useEffect, useRef, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { Users, BarChart3, Search, MoreHorizontal, Reply, Edit3, Plus, X, Send, Link2, Trash2, Pin } from 'lucide-react';
import { formatMessageTime } from '../utils/messageTime';
import AttachmentControls from './AttachmentControls';
import AttachmentActions from './AttachmentActions';
import AttachmentPreview from './AttachmentPreview';

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

export default function ChatCanvas({ selectedChat, messages, user, setModal, replyTo, setReplyTo, editing, setEditing, composer, setComposer, onSendMessage, apiBridge, onDeleteGroup, onGroupInvite, onAttachmentUploaded }) {
  const historyRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const [groupActionMessage, setGroupActionMessage] = useState('');
  const [pollVoteState, setPollVoteState] = useState({});

  useEffect(() => {
    const viewport = historyRef.current;
    if (!viewport || !shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => { viewport.scrollTop = viewport.scrollHeight; });
  }, [selectedChat?.id, messages.length]);

  useEffect(() => { setGroupActionMessage(''); setPollVoteState({}); }, [selectedChat?.id]);

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
              <button className="action-utility-btn" onClick={async () => { try { const response = await onGroupInvite(selectedChat); if (response?.invite_url) { await navigator.clipboard.writeText(response.invite_url); setGroupActionMessage('Group link copied'); setTimeout(() => setGroupActionMessage(''), 1600); } } catch (err) { setGroupActionMessage(err.message || 'Unable to generate group link'); } }}><Link2 size={16}/><span>Copy Link</span></button>
              <button className="action-utility-btn text-red" style={{ color: '#ef4444' }} onClick={() => onDeleteGroup(selectedChat)}><Trash2 size={18}/><span>Delete Group</span></button>
            </>}
          </> : <button className="action-utility-btn" onClick={() => setModal('group')}><Users size={18}/><span>New Group</span></button>}

          <div className="vertical-divider" /><button className="icon-utility-only"><Search size={18}/></button><button className="icon-utility-only"><MoreHorizontal size={18}/></button>
        </div>
      </header>

      {groupActionMessage && <div style={{ padding: '7px 14px', fontSize: '12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>{groupActionMessage}</div>}

      <div className="message-history-viewport" ref={historyRef} onScroll={handleHistoryScroll}>
        <div className="encryption-note">Messages are protected in transit. E2EE configuration applied.</div>

        {messages.map(msg => {
          const isMine = msg.sender_id == user?.id || msg.user_id == user?.id || msg.mine === true;
          const isPoll = msg.type === 'poll';
          const isAttachment = msg.type === 'attachment' && msg.attachment;
          const messageContent = msg.body || msg.text || '';
          const poll = msg.poll;
          const visibleOptions = pollVoteState[msg.poll_id] || poll?.options || [];
          const messageTime = formatMessageTime(msg.created_at || msg.timestamp || msg.time);
          const senderLabel = isGroup ? (isMine ? 'You' : (msg.sender_name || 'Member')) : null;
          const attachmentIsImage = isAttachment && String(msg.attachment.mime_type || '').startsWith('image/');

          return <div key={msg.id} className={`message-bubble-wrapper ${isMine ? 'outgoing-align' : 'incoming-align'}`}>
            {isPoll ? <div className="poll-bubble-card" style={pollCardStyle}>
              {senderLabel && <div style={senderNameStyle}>{senderLabel}</div>}
              <div style={pollHeaderStyle}><span style={{ fontSize: '18px' }}>📊</span><h4 style={pollTitleStyle}>{poll?.question || 'Poll'}</h4></div>
              <div style={pollOptionsStyle}>{visibleOptions.map(option => <button key={option.id} type="button" onClick={() => handleCastVote(msg.poll_id || poll?.id, option.id)} style={pollOptionStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span>{option.text}</span><strong>{option.votes || 0}</strong></div>{option.selected && <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--primary-color)' }}>Your vote</div>}</button>)}</div>
              <div className="bubble-meta-footer" style={pollFooterStyle}><span>Active Voting Room</span><span>{messageTime}</span></div>
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

                {attachmentIsImage && <AttachmentPreview attachment={msg.attachment} />}

                <div style={attachmentMetaStyle}>
                  {!attachmentIsImage && <span style={attachmentIconStyle}>📎</span>}
                  <div style={{ minWidth: 0 }}>
                    <div style={attachmentNameStyle}>{msg.attachment.name}</div>
                    <div style={attachmentDetailsStyle}>
                      {Math.ceil(Number(msg.attachment.file_size || 0) / 1024)} KB · {msg.attachment.download_policy === 'VIEW_ONLY' ? 'View only' : msg.attachment.download_policy === 'ALLOW' ? 'Download allowed' : 'Approval required'}
                    </div>
                  </div>
                </div>
              </div> : <p className="bubble-text-content">{messageContent}</p>}
              <div className="bubble-meta-footer"><span className="bubble-time">{messageTime}</span>{msg.edited && <span className="edited-flag">· Edited</span>}</div>
              <div className="bubble-action-triggers"><button onClick={() => setReplyTo(msg)} title="Reply"><Reply size={12} /></button>{isMine && !isAttachment && <button onClick={() => { setEditing(msg); setComposer(messageContent); }} title="Edit"><Edit3 size={12} /></button>}</div>
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
        <div className="message-input-composer-bar">
          <button className="composer-addon-btn">😊</button><AttachmentControls selectedChat={selectedChat} apiBridge={apiBridge} onUploaded={onAttachmentUploaded} /><button className="composer-addon-btn"><Pin size={18} /></button><button className="composer-addon-btn"><Send size={18} /></button>
          <input type="text" placeholder={selectedChat ? 'Type a message...' : 'Select a conversation to start messaging'} value={composer} onChange={e => setComposer(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSendMessage()} disabled={!selectedChat} className="composer-text-input" />
          <button className="voice-mic-submit-btn" onClick={onSendMessage} disabled={!selectedChat}><Send size={18} /></button>
        </div>
      </div>
    </main>
  );
}
