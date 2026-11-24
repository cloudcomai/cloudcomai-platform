import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

const OPTIONS = [
  { id: 'light', label: 'Light', description: 'A clean, bright workspace', Icon: Sun },
  { id: 'dark', label: 'Dark', description: 'Soft charcoal with indigo accents', Icon: Moon },
  { id: 'system', label: 'System Default', description: 'Follow your computer appearance', Icon: Monitor },
];

export default function DesktopAppearancePicker({ value = 'system', onChange }) {
  return (
    <section className="desktop-appearance-picker" aria-labelledby="desktop-appearance-title">
      <div className="desktop-appearance-heading">
        <div>
          <h3 id="desktop-appearance-title">Appearance &amp; Chat Theme</h3>
          <p>Choose how CloudComAI looks in your web browser.</p>
        </div>
        <span className="desktop-only-label">WEB ONLY</span>
      </div>
      <div className="desktop-appearance-options" role="group" aria-label="Web appearance">
        {OPTIONS.map(({ id, label, description, Icon }) => (
          <button
            key={id}
            type="button"
            className={value === id ? 'desktop-appearance-option selected' : 'desktop-appearance-option'}
            aria-pressed={value === id}
            onClick={() => onChange?.(id)}
          >
            <span className={`desktop-appearance-icon desktop-preview-${id}`}><Icon size={19} aria-hidden="true" /></span>
            <span className="desktop-appearance-copy"><strong>{label}</strong><small>{description}</small></span>
            <span className="desktop-appearance-radio" aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="desktop-appearance-footnote">Applies to the CloudComAI web application only. Your Android and iOS app themes remain unchanged.</p>
    </section>
  );
}
