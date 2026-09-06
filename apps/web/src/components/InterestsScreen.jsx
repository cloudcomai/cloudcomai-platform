import React, { useMemo, useState } from 'react';

export default function InterestsScreen({ interests, topInterests, saveAndContinue, cancel }) {
  const [selected, setSelected] = useState(topInterests);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const orderedInterests = useMemo(() => [
    ...selected.filter(interest => interests.includes(interest)),
    ...interests.filter(interest => !selected.includes(interest)),
  ], [interests, selected]);

  const toggle = interest => {
    setError('');
    setSelected(current => current.includes(interest)
      ? current.filter(value => value !== interest)
      : [...current, interest]);
  };

  const save = async () => {
    if (selected.length === 0) return setError('Select at least one preference.');
    setSaving(true);
    setError('');
    try { await saveAndContinue(selected); }
    catch (saveError) { setError(saveError.message || 'Unable to save preferences.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card wide" style={{ maxWidth: '600px' }}>
        <h2>Select Your Preferences</h2>
        <p style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>Choose chats, communities and interests to show in your middle panel.</p>
        <p style={{ marginBottom: '20px', color: 'var(--text-light)', fontSize: '12px' }}>Selected preferences appear first. Select them in the order you want displayed.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
          {orderedInterests.map(i => {
            const isSelected = selected.includes(i);
            return (
              <button 
                type="button"
                key={i} 
                className={`filter-pill ${isSelected ? 'active' : ''}`} 
                onClick={() => toggle(i)}
              >
                {i}
              </button>
            );
          })}
        </div>
        {error && <div className="error" style={{ marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="filter-pill" onClick={cancel} disabled={saving}>Cancel</button>
          <button type="button" className="primary" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save preferences & enter app'}</button>
        </div>
      </div>
    </div>
  );
}
