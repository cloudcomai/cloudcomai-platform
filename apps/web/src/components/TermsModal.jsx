import React from 'react';
import termsOfService from '../content/terms-of-service.txt?raw';
import LegalDocumentModal from './LegalDocumentModal';

export default function TermsModal({ onClose }) {
  return (
    <LegalDocumentModal
      title="CloudComAI Terms of Service"
      sourceText={termsOfService}
      onClose={onClose}
    />
  );
}
