import React from 'react';
import privacyPolicy from '../content/privacy-policy.txt?raw';
import LegalDocumentModal from './LegalDocumentModal';

export default function PrivacyPolicyModal({ onClose }) {
  return (
    <LegalDocumentModal
      title="CloudComAI Privacy Policy"
      sourceText={privacyPolicy}
      onClose={onClose}
    />
  );
}
