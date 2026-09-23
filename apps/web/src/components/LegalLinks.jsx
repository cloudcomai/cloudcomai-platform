import React from 'react';

export default function LegalLinks() {
  return <nav aria-label="Legal documents" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '16px 0', fontSize: '14px' }}>
    {[['privacy-policy', 'Privacy Policy'], ['terms-of-service', 'Terms & Conditions'], ['account-deletion', 'Account & data deletion']].map(([file, label]) => <a key={file} href={`${import.meta.env.BASE_URL}${file}.html`} target="_blank" rel="noopener noreferrer">{label}</a>)}
  </nav>;
}
