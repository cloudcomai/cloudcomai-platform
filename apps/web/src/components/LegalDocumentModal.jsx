import React, { useEffect, useId, useMemo, useRef } from 'react';

const HEADING_PATTERN = /^\d+(?:\.\d+)*\.\s+\S/;
const ORDERED_ITEM_PATTERN = /^\d+\.\s+/;

function documentBlocks(sourceText) {
  return sourceText
    .replace(/\r/g, '')
    .trim()
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean);
}

function LegalBlock({ block, index, documentTitle }) {
  const lines = block.split('\n').map(line => line.trim()).filter(Boolean);

  if (
    !lines.length ||
    block.startsWith('Important implementation requirement:') ||
    block.startsWith('CloudComAI should obtain legal advice before selecting')
  ) {
    return null;
  }

  if (block === '⸻') {
    return <hr className="cloudcom-legal-separator" />;
  }

  if (index === 0 && lines.length === 1 && lines[0].toUpperCase() === documentTitle.toUpperCase()) {
    return null;
  }

  if (index <= 1 && lines.length > 1 && lines.every(line => line.includes(':'))) {
    return (
      <div className="cloudcom-legal-metadata">
        {lines.map(line => <span key={line}>{line}</span>)}
      </div>
    );
  }

  if (lines.every(line => line.startsWith('* '))) {
    return (
      <ul>
        {lines.map(line => <li key={line}>{line.slice(2)}</li>)}
      </ul>
    );
  }

  if (lines.length > 1 && lines.every(line => ORDERED_ITEM_PATTERN.test(line))) {
    return (
      <ol>
        {lines.map(line => <li key={line}>{line.replace(ORDERED_ITEM_PATTERN, '')}</li>)}
      </ol>
    );
  }

  if (lines.length === 1 && HEADING_PATTERN.test(lines[0])) {
    return <h3>{lines[0]}</h3>;
  }

  return (
    <p>
      {lines.map((line, lineIndex) => (
        <React.Fragment key={`${line}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {line}
        </React.Fragment>
      ))}
    </p>
  );
}

export default function LegalDocumentModal({ title, sourceText, onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);
  const blocks = useMemo(() => documentBlocks(sourceText), [sourceText]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="cloudcom-terms-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="cloudcom-terms-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="cloudcom-terms-header">
          <h2 id={titleId}>{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="cloudcom-terms-close"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>

        <div className="cloudcom-terms-content">
          {blocks.map((block, index) => (
            <LegalBlock
              key={`${index}-${block.slice(0, 30)}`}
              block={block}
              index={index}
              documentTitle={title}
            />
          ))}
        </div>

        <div className="cloudcom-terms-footer">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
