import React from "react";

export default function TermsModal({ onClose }) {
  return (
    <div className="cloudcom-terms-overlay">
      <div
        className="cloudcom-terms-window"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="cloudcom-terms-header">
          <h2>Terms & Conditions</h2>

          <button
            type="button"
            className="cloudcom-terms-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="cloudcom-terms-content">

          <h3>1. Acceptance of Terms</h3>
          <p>
            By creating an account or using CloudCom, you agree
            to these Terms & Conditions and our Privacy Policy.
          </p>

          <h3>2. Account Registration</h3>
          <p>
            You must provide accurate and complete information
            when creating your account. You are responsible for
            maintaining the security of your account.
          </p>

          <h3>3. Acceptable Use</h3>
          <p>
            You must not use CloudCom for unlawful activities,
            harassment, fraud, spam, impersonation, unauthorised
            access, or distribution of malicious software.
          </p>

          <h3>4. Messages and User Content</h3>
          <p>
            You are responsible for messages and other content
            that you submit or share through CloudCom.
          </p>

          <h3>5. Privacy</h3>
          <p>
            Personal information is processed in accordance
            with our Privacy Policy and applicable Indian law.
          </p>

          <h3>6. Account Suspension</h3>
          <p>
            We may suspend or terminate accounts that violate
            these Terms or applicable law.
          </p>

          <h3>7. Governing Law</h3>
          <p>
            These Terms are governed by the laws of India,
            subject to applicable law.
          </p>

          <h3>8. Changes to Terms</h3>
          <p>
            We may update these Terms from time to time.
            Where required, appropriate notice will be provided.
          </p>

          <h3>9. Contact</h3>
          <p>
            For questions regarding these Terms, contact:
            <br />
            support@cloudcomai.com
          </p>

          <p className="cloudcom-terms-updated">
            Last updated: August 2026
          </p>

        </div>

        {/* Footer */}
        <div className="cloudcom-terms-footer">
          <button
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}