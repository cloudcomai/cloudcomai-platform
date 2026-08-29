import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export default function PollModal({ selectedChat, apiBridge, close, onPollCreated }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);

  const handleAddOptionField = () => {
    if (options.length >= 6) return alert('Maximum of 6 poll choices allowed.');
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
      return alert('Select a chat before creating a poll.');
    }

    const cleanQuestion = question.trim();
    const cleanOptions = [...new Set(
      options
        .map(option => option.trim())
        .filter(Boolean)
    )];

    if (!cleanQuestion || cleanOptions.length < 2) {
      return alert('Provide a clear poll question and at least 2 different options.');
    }

    setLoading(true);
    try {
      const payload = {
        chat_id: Number(selectedChat.id),
        question: cleanQuestion,
        options: cleanOptions
      };

      const response = await apiBridge('/polls.php', {
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
      <form onSubmit={handleSubmitPoll} className="modal-content-card" style={{ textAlign: 'left', width: '460px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>📊 Create Real-Time Poll</h3>
          <button type="button" onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-light)' }}><X size={20}/></button>
        </div>

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
              required
              placeholder={`Option ${index + 1}`}
              value={opt}
              onChange={e => handleOptionChange(index, e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '14px' }}
            />
            {options.length > 2 && (
              <button type="button" onClick={() => handleRemoveOptionField(index)} style={{ color: '#ef4444', padding: '4px' }}><Trash2 size={16}/></button>
            )}
          </div>
        ))}

        <button type="button" onClick={handleAddOptionField} style={{ color: 'var(--primary-color)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', marginBottom: '20px' }}>
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
