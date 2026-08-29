import React, { useEffect, useRef } from 'react';

export default function ChatScrollAnchor({ dependency }) {
  const anchorRef = useRef(null);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [dependency]);

  return <div ref={anchorRef} aria-hidden="true" style={{ height: 1 }} />;
}
