import React, { useMemo, useState } from 'react';
import { EMOJI_CATEGORIES, searchEmojiItems } from '@cloudcomai/chat-core';

export default function EmojiPicker({ onSelect, onDelete, onClose }) {
  const [category, setCategory] = useState('smileys');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState([]);
  const active = EMOJI_CATEGORIES.find(item => item.id === category) || EMOJI_CATEGORIES[1];
  const items = useMemo(() => {
    const source = category === 'recent' ? recent : active.emojis;
    return searchEmojiItems(query ? EMOJI_CATEGORIES.slice(1).flatMap(item => item.emojis) : source, query);
  }, [active, category, query, recent]);
  return <section className="cloud-emoji-picker" aria-label="Emoji picker">
    <div className="cloud-emoji-picker-top">
      <label className="cloud-emoji-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search emoji" aria-label="Search emoji" /></label>
      <button type="button" className="cloud-emoji-utility" onClick={onDelete} aria-label="Delete last character" title="Delete last character">⌫</button>
      <button type="button" className="cloud-emoji-utility" onClick={onClose} aria-label="Close emoji picker" title="Close">×</button>
    </div>
    <div className="cloud-emoji-grid" role="list" aria-label={query ? 'Search results' : active.label}>
      {items.map(([emoji, keywords]) => <button key={emoji + keywords} type="button" role="listitem" className="cloud-emoji-cell" title={keywords} aria-label={keywords} onClick={() => { onSelect?.(emoji); setRecent(current => [[emoji, keywords], ...current.filter(item => item[0] !== emoji)].slice(0, 32)); }}>{emoji}</button>)}
      {!items.length && <p className="cloud-emoji-empty">No matching emoji found.</p>}
    </div>
    <nav className="cloud-emoji-categories" aria-label="Emoji categories">
      {EMOJI_CATEGORIES.map(item => <button key={item.id} type="button" className={category === item.id && !query ? 'active' : ''} aria-label={item.label} aria-pressed={category === item.id && !query} title={item.label} onClick={() => { setCategory(item.id); setQuery(''); }}>{item.icon}</button>)}
    </nav>
  </section>;
}
