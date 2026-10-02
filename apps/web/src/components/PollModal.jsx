import React, { useState } from 'react';
import { pollDateExpiry } from '@cloudcomai/chat-core';
import { ApiRoute } from '@cloudcomai/api-client';
import { X, Plus, Trash2 } from 'lucide-react';

export default function PollModal({ selectedChat, apiBridge, close, onPollCreated }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [expiry, setExpiry] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddOptionField = () => {
    if (options.length >= 4) return alert('Maximum of 4 poll choices allowed.');
    setOptions([...options, '']);
  };

  const handleRemoveOptionField = (index) => {
    if (options.length <= 2) return alert('A poll requires at least 2 choices.');
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  const handleSubmitPoll = async (e) => {
    e.preventDefault();

    if (!selectedChat?.id) {
      return alert('Select a group or public chat before creating a poll.');
    }

    const chatType = selectedChat.type;
    const isAllowedChat = chatType === 'group' || chatType === 'public';
    if (!isAllowedChat) {
      return alert('Polls are available only in group and public chats.');
    }

    const cleanQuestion = question.trim();
    const cleanOptions = [...new Set(
      options
        .map(option => option.trim())
        .filter(Boolean)
    )];

    if (!cleanQuestion || cleanOptions.length < 2 || cleanOptions.length > 4) {
      return alert('Provide a clear poll question and 2 to 4 different options.');
    }

    setLoading(true);
    try {
      const payload = {
        chat_id: Number(selectedChat.id),
        question: cleanQuestion,
        expires_at: pollDateExpiry(expiry),
        options: cleanOptions
      };

      const response = await apiBridge(ApiRoute.POLLS, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (response.message) {
        onPollCreated(response.message);
      }
      close();
    } catch (err) {
      alert(err.message || 'Failed to broadcast secure poll.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form onSubmit={handleSubmitPoll} className="modal-content-card" style={{ textAlign: 'left', width: '460px', maxWidth: 'calc(100vw - 32px)', maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>📊 Create Real-Time Poll</h3>
          <button type="button" onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-light)' }}><X size={20}/></button>
        </div>

        <label style={{ display: 'block', marginBottom: 14 }}>Expiry date (optional)
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={{ width: '100%' }} />
          <small>Leave blank for 30 days. A chosen date expires at the end of that day in your time zone.</small>
        </label>
        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Question / Topic</label>
        <input
          required
          placeholder="What is your team update today?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '14px', background: 'var(--bg-primary)', color: 'var(--text-main)' }}
        />

        <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Response Options (2–4)</label>
        {options.map((opt, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              required
              placeholder={`Option ${index + 1}`}
              value={opt}
              onChange={e => handleOptionChange(index, e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '14px' }}
            />
            {options.length > 2 && (
              <button type="button" onClick={() => handleRemoveOptionField(index)} style={{ color: '#ef4444', padding: '4px' }}><Trash2 size={16}/></button>
            )}
          </div>
        ))}

        <button type="button" onClick={handleAddOptionField} disabled={options.length >= 4} style={{ color: 'var(--primary-color)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', marginBottom: '20px', opacity: options.length >= 4 ? 0.5 : 1 }}>
          <Plus size={16}/> Add Option Choice
        </button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <button type="button" className="filter-pill" onClick={close} style={{ border: 'none', background: 'var(--bg-directory)' }}>Cancel</button>
          <button type="submit" className="primary" style={{ background: 'var(--primary-color)', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '600' }} disabled={loading}>
            {loading ? 'Publishing...' : 'Publish Poll'}
          </button>
        </div>
      </form>
    </div>
  );
}
