import React from 'react';

export default function PrivacyPolicyModal({ onClose }) {
  return (
    <div className="cloudcom-terms-overlay" onClick={onClose}>
      <div className="cloudcom-terms-window" onClick={e => e.stopPropagation()}>
        <div className="cloudcom-terms-header">
          <h2>Privacy Policy</h2>
          <button type="button" className="cloudcom-terms-close" onClick={onClose}>×</button>
        </div>
        <div className="cloudcom-terms-content">
          <h3>1. Information We Collect</h3>
          <p>We may collect account details such as your name, email address, mobile number and user ID that you provide when registering.</p>
          <h3>2. How We Use Information</h3>
          <p>Information is used to provide authentication, messaging, contacts, groups and related CloudComAI services.</p>
          <h3>3. Messages and Contacts</h3>
          <p>Chat and contact information is processed to provide communication features. Access to third-party contacts requires the permissions you grant.</p>
          <h3>4. Security</h3>
          <p>We use reasonable technical and organisational measures to protect account and communication data.</p>
          <h3>5. Your Choices</h3>
          <p>You may request information about your account data and use available account controls to manage your information.</p>
          <h3>6. Contact</h3>
          <p>For privacy questions, contact support@cloudcomai.com.</p>
          <p className="cloudcom-terms-updated">Last updated: August 2026</p>
        </div>
        <div className="cloudcom-terms-footer"><button type="button" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
