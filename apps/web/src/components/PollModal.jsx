import React, { useEffect, useState } from 'react';
import { pollDateExpiry } from '@cloudcomai/chat-core';
import { ApiRoute } from '@cloudcomai/api-client';
import { X, Plus, Trash2, Check } from 'lucide-react';
import {
  canCreatePoll,
  cleanPollOptions,
  DEFAULT_POLL_OPTION_FIELDS,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
} from '../utils/pollCreation';

export default function PollModal({ selectedChat, apiBridge, close, onPollCreated }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(Array(DEFAULT_POLL_OPTION_FIELDS).fill(''));
  const [expiry, setExpiry] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loading, setLoading] = useState(false);
  const [groupLoadError, setGroupLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadGroups = async () => {
      setLoadingGroups(true);
      setGroupLoadError('');
      try {
        const response = await apiBridge(ApiRoute.CHATS, {
          method: 'GET',
          query: { type: 'group' }
        });
        if (!cancelled) setGroups(Array.isArray(response.chats) ? response.chats : []);
      } catch (err) {
        if (!cancelled) setGroupLoadError(err.message || 'Unable to load groups.');
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };
    loadGroups();
    return () => { cancelled = true; };
  }, [apiBridge]);

  const toggleGroup = id => {
    const groupId = Number(id);
    setSelectedGroupIds(current => current.includes(groupId)
      ? current.filter(value => value !== groupId)
      : [...current, groupId]);
  };

  const handleAddOptionField = () => {
    if (options.length >= MAX_POLL_OPTIONS) return alert(`Maximum of ${MAX_POLL_OPTIONS} poll choices allowed.`);
    setOptions([...options, '']);
  };

  const handleRemoveOptionField = index => {
    if (options.length <= MIN_POLL_OPTIONS) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  const handleSubmitPoll = async e => {
    e.preventDefault();
    if (loading) return;

    if (!selectedGroupIds.length) {
      return alert('Select at least one group before creating a poll.');
    }

    const cleanQuestion = question.trim();
    const cleanOptions = cleanPollOptions(options);

    if (!cleanQuestion) return alert('Please enter a poll question.');
    if (!canCreatePoll({ question: cleanQuestion, groupIds: selectedGroupIds, options: cleanOptions })) {
      return alert('Please enter at least 3 poll options.');
    }

    setLoading(true);
    try {
      const response = await apiBridge(ApiRoute.POLLS, {
        method: 'POST',
        body: JSON.stringify({
          chat_ids: selectedGroupIds,
          question: cleanQuestion,
          expires_at: pollDateExpiry(expiry),
          options: cleanOptions
        })
      });

      const createdMessages = Array.isArray(response.messages)
        ? response.messages
        : response.message ? [response.message] : [];
      const currentChatId = Number(selectedChat?.id || 0);
      const currentChatMessage = createdMessages.find(message => Number(message.chat_id) === currentChatId);
      if (currentChatMessage) onPollCreated(currentChatMessage);
      close();
    } catch (err) {
      alert(err.message || 'Failed to broadcast secure poll.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form onSubmit={handleSubmitPoll} className="modal-content-card" style={{ textAlign: 'left', width: '520px', maxWidth: 'calc(100vw - 32px)', maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>📊 Create Real-Time Poll</h3>
          <button type="button" onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-light)' }}><X size={20}/></button>
        </div>

        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Groups</label>
        {loadingGroups ? (
          <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: '13px' }}>Loading groups…</div>
        ) : groupLoadError ? (
          <div style={{ padding: '12px', color: '#b91c1c', background: '#fef2f2', borderRadius: '8px', marginBottom: '14px' }}>{groupLoadError}</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '12px', color: 'var(--text-muted)', background: 'var(--bg-directory)', borderRadius: '8px', marginBottom: '14px' }}>No groups are available for polling.</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
            {groups.map(group => {
              const groupId = Number(group.id);
              const selected = selectedGroupIds.includes(groupId);
              return (
                <button
                  key={groupId}
                  type="button"
                  onClick={() => toggleGroup(groupId)}
                  aria-pressed={selected}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    textAlign: 'left',
                    border: `1px solid ${selected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    flex: '0 0 20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '5px',
                    border: `1px solid ${selected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: selected ? 'var(--primary-color)' : 'transparent',
                    color: selected ? '#fff' : 'transparent'
                  }}>
                    <Check size={14} />
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name || `Group ${groupId}`}</span>
                </button>
              );
            })}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 14 }}>Expiry date (optional)
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={{ width: '100%' }} />
          <small>Leave blank for 30 days. A chosen date expires at the end of your local day.</small>
        </label>

        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Question / Topic</label>
        <input
          required
          placeholder="What is your team update today?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '14px', background: 'var(--bg-primary)', color: 'var(--text-main)' }}
        />

        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Response Options</label>
        {options.map((opt, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              placeholder={`Option ${index + 1}`}
              value={opt}
              onChange={e => handleOptionChange(index, e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '14px' }}
            />
            {options.length > MIN_POLL_OPTIONS && (
              <button type="button" onClick={() => handleRemoveOptionField(index)} style={{ color: '#ef4444', padding: '4px' }} aria-label={`Remove option ${index + 1}`}><Trash2 size={16}/></button>
            )}
          </div>
        ))}

        <button type="button" onClick={handleAddOptionField} style={{ color: 'var(--primary-color)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', marginBottom: '20px' }} disabled={options.length >= MAX_POLL_OPTIONS}>
          <Plus size={16}/> Add option
        </button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <button type="button" className="filter-pill" onClick={close} style={{ border: 'none', background: 'var(--bg-directory)' }}>Cancel</button>
          <button type="submit" className="primary" style={{ background: 'var(--primary-color)', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '600' }} disabled={loading || loadingGroups || groups.length === 0}>
            {loading ? 'Publishing...' : 'Publish Poll'}
          </button>
        </div>
      </form>
    </div>
  );
}
