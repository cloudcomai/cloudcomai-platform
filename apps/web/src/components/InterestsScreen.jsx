import React from 'react';

export default function InterestsScreen({ interests, topInterests, setTopInterests, saveAndContinue }) {
  return (
    <div className="auth-page">
      <div className="auth-card wide" style={{ maxWidth: '600px' }}>
        <h2>Select Your Preferences</h2>
        <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>Choose channels to anchor onto your dashboard</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
          {interests.map(i => {
            const isSelected = topInterests.includes(i);
            return (
              <button 
                type="button"
                key={i} 
                className={`filter-pill ${isSelected ? 'active' : ''}`} 
                onClick={() => setTopInterests(prev => isSelected ? prev.filter(x => x !== i) : [...prev, i])}
              >
                {i}
              </button>
            );
          })}
        </div>
        <button className="primary wide" onClick={saveAndContinue}>Save preferences & enter app</button>
      </div>
    </div>
  );
}
