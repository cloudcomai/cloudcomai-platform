import React, { useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Bot,
  CheckCircle2,
  FileCheck2,
  Globe2,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import TermsModal from './TermsModal';
import './home.css';

const availableFeatures = [
  {
    icon: MessageCircle,
    title: 'Private conversations',
    description: 'Start focused one-to-one chats with people who are registered on CloudComAI.',
    tags: ['Replies', 'Message editing', 'Presence'],
  },
  {
    icon: Users,
    title: 'Purpose-built groups',
    description: 'Create family, study, workplace and community groups with clear membership controls.',
    tags: ['Owner roles', 'Invitations', 'Retention'],
  },
  {
    icon: UserCheck,
    title: 'People you already know',
    description: 'Connect Google Contacts and show matches only when that person already has an account.',
    tags: ['User matching', 'Contact sync', 'Privacy controls'],
  },
  {
    icon: FileCheck2,
    title: 'Approval-based attachments',
    description: 'Keep shared media visible in the conversation while the sender controls download approval.',
    tags: ['Image previews', 'Documents', 'Download requests'],
  },
  {
    icon: MessagesSquare,
    title: 'Richer conversations',
    description: 'Use replies, polls and message controls without losing the flow of the discussion.',
    tags: ['Polls', 'Reactions-ready', 'Incremental refresh'],
  },
  {
    icon: BellRing,
    title: 'Notification foundation',
    description: 'Web and Expo-ready notification controls keep alerts configurable for every environment.',
    tags: ['User devices', 'Delivery queue', 'Feature toggle'],
  },
];

const roadmapFeatures = [
  {
    icon: LockKeyhole,
    title: 'Advanced encryption',
    description: 'Additional message-protection capabilities are part of the security roadmap.',
  },
  {
    icon: Bot,
    title: 'AI-assisted safety',
    description: 'Smart spam detection, moderation and writing assistance are planned product capabilities.',
  },
  {
    icon: Smartphone,
    title: 'Native mobile releases',
    description: 'The Expo mobile foundation supports Android and future iOS distribution workflows.',
  },
];

const assetUrl = path => `${import.meta.env.BASE_URL}${path}`;

function SectionHeading({ id, eyebrow, title, description, inverse = false }) {
  return (
    <div className={`landing-section-heading ${inverse ? 'inverse' : ''}`}>
      <span className="landing-eyebrow">{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export default function HomePage({ user, onLogin, onRegister, onOpenApp, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalDocument, setLegalDocument] = useState(null);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="landing-page" id="top">
      <header className="landing-header">
        <div className="landing-container landing-nav-row">
          <a className="landing-logo" href="#top" onClick={closeMenu} aria-label="CloudComAI home">
            <BrandLogo variant="dark" className="landing-logo-image" />
          </a>

          <nav className={`landing-nav-links ${mobileMenuOpen ? 'open' : ''}`} aria-label="Main navigation">
            <a href="#features" onClick={closeMenu}>Features</a>
            <a href="#security" onClick={closeMenu}>Security & roadmap</a>
            <a href="#why" onClick={closeMenu}>Why CloudComAI</a>
            <a href="#about" onClick={closeMenu}>About</a>
            <a href="#contact" onClick={closeMenu}>Contact</a>
          </nav>

          <div className="landing-nav-actions">
            {user ? (
              <>
                <span className="landing-account-chip" title={user.email || user.user_id || user.name}>
                  <span>{(user.name || 'U').slice(0, 1).toUpperCase()}</span>
                  {user.name || 'Account'}
                </span>
                <button className="landing-button landing-button-primary landing-button-small" type="button" onClick={onOpenApp}>
                  Open app
                </button>
                <button className="landing-button landing-button-ghost landing-button-small landing-desktop-action" type="button" onClick={onLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button className="landing-button landing-button-ghost landing-button-small landing-desktop-action" type="button" onClick={onLogin}>
                  Log in
                </button>
                <button className="landing-button landing-button-primary landing-button-small" type="button" onClick={onRegister}>
                  Get started
                </button>
              </>
            )}
            <button
              className="landing-menu-button"
              type="button"
              onClick={() => setMobileMenuOpen(value => !value)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-glow landing-hero-glow-one" />
          <div className="landing-hero-glow landing-hero-glow-two" />
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow landing-eyebrow-dark"><ShieldCheck size={15} /> Privacy-first communication</span>
              <h1>Secure Chats.<br />Smart Features.<br /><span>Total Control.</span></h1>
              <p>
                CloudComAI brings private conversations, groups, registered-contact discovery,
                attachment approvals and mobile-ready notifications into one focused experience.
              </p>
              <div className="landing-hero-actions">
                <button className="landing-button landing-button-primary" type="button" onClick={user ? onOpenApp : onRegister}>
                  {user ? 'Open CloudComAI' : 'Create your account'} <ArrowRight size={18} />
                </button>
                {!user && (
                  <button className="landing-button landing-button-ghost" type="button" onClick={onLogin}>
                    Sign in
                  </button>
                )}
              </div>
              <div className="landing-trust-row">
                <span><CheckCircle2 size={16} /> HTTPS protected</span>
                <span><Globe2 size={16} /> Web and mobile foundation</span>
                <span><FileCheck2 size={16} /> Controlled sharing</span>
              </div>
            </div>

            <div className="landing-product-stage" aria-label="CloudComAI conversation preview">
              <div className="landing-stage-badge landing-stage-badge-one"><ShieldCheck size={16} /> Privacy controls</div>
              <div className="landing-stage-badge landing-stage-badge-two"><UserCheck size={16} /> Known contacts</div>
              <div className="landing-phone">
                <div className="landing-phone-top"><span /><span /><span /></div>
                <div className="landing-phone-header">
                  <div className="landing-phone-avatar">C</div>
                  <div><strong>CloudComAI</strong><small>Private conversation</small></div>
                </div>
                <div className="landing-phone-security"><ShieldCheck size={14} /> Conversation controls enabled</div>
                <div className="landing-bubble landing-bubble-in">Are we still on for the project call?</div>
                <div className="landing-bubble landing-bubble-out">Yes, joining in five minutes.</div>
                <div className="landing-attachment-preview">
                  <FileCheck2 size={22} />
                  <div><strong>Project brief.pdf</strong><small>Download approval available</small></div>
                </div>
                <div className="landing-composer"><span>Write a message...</span><ArrowRight size={17} /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-proof-strip" aria-label="CloudComAI principles">
          <div className="landing-container landing-proof-grid">
            <div><strong>18+</strong><span>Adult account policy</span></div>
            <div><strong>34</strong><span>Language-independent API routes</span></div>
            <div><strong>Web + Mobile</strong><span>One shared platform foundation</span></div>
            <div><strong>User first</strong><span>Controls designed around consent</span></div>
          </div>
        </section>

        <section className="landing-section landing-tour" aria-labelledby="tour-heading">
          <div className="landing-container">
            <SectionHeading
              id="tour-heading"
              eyebrow="Product tour"
              title="See the CloudComAI product vision"
              description="A visual overview of conversations, communities, attachments, safety controls and multi-device access."
            />
            <figure className="landing-visual-frame">
              <img
                src={assetUrl('brand/cloudcomai-product-tour.webp')}
                alt="CloudComAI product concept showing chats, groups, safety controls, attachment approval and community features"
                loading="lazy"
              />
              <figcaption>Concept artwork from the supplied home-page design. Feature availability may vary during beta.</figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-section landing-features" id="features">
          <div className="landing-container">
            <SectionHeading
              eyebrow="Available foundation"
              title="Built for conversations that stay under your control"
              description="The current platform focuses on practical messaging, groups, contacts and approval-aware sharing."
            />
            <div className="landing-feature-grid">
              {availableFeatures.map(({ icon: Icon, title, description, tags }) => (
                <article className="landing-feature-card" key={title}>
                  <div className="landing-feature-icon"><Icon size={25} /></div>
                  <span className="landing-status-badge">Available in beta</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <div className="landing-tag-row">
                    {tags.map(tag => <span key={tag}>{tag}</span>)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-roadmap" id="security">
          <div className="landing-container landing-roadmap-grid">
            <div>
              <SectionHeading
                eyebrow="Security and intelligence"
                title="A transparent roadmap, not vague promises"
                description="CloudComAI separates what is available today from capabilities that still require engineering, infrastructure and security validation."
                inverse
              />
              <div className="landing-roadmap-list">
                {roadmapFeatures.map(({ icon: Icon, title, description }) => (
                  <div className="landing-roadmap-item" key={title}>
                    <div><Icon size={22} /></div>
                    <span><strong>{title}</strong><small>{description}</small></span>
                    <em>Roadmap</em>
                  </div>
                ))}
              </div>
            </div>
            <figure className="landing-vision-card">
              <img
                src={assetUrl('brand/cloudcomai-feature-vision.webp')}
                alt="CloudComAI future feature concept artwork"
                loading="lazy"
              />
              <figcaption><Sparkles size={15} /> Product vision artwork; roadmap items are not guarantees of current availability.</figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-section landing-why" id="why">
          <div className="landing-container">
            <SectionHeading
              eyebrow="Why CloudComAI"
              title="One platform, three clear principles"
              description="Designed to evolve without tying the user experience to one backend language or hosting provider."
            />
            <div className="landing-principle-grid">
              <article><span>01</span><ShieldCheck size={28} /><h3>Control by design</h3><p>Consent-aware sharing and account-level controls are part of the product flow, not an afterthought.</p></article>
              <article><span>02</span><Globe2 size={28} /><h3>Portable architecture</h3><p>Stable API routes keep web and mobile clients independent from the PHP implementation behind them.</p></article>
              <article><span>03</span><Sparkles size={28} /><h3>Honest evolution</h3><p>Beta features and future capabilities are labelled clearly while the production foundation matures.</p></article>
            </div>
          </div>
        </section>

        <section className="landing-section landing-about" id="about">
          <div className="landing-container landing-about-grid">
            <div>
              <span className="landing-eyebrow">About us</span>
              <h2>Communication that puts people back in control</h2>
              <p>CloudComAI is being designed for individuals, families, teams and communities that want a simpler way to communicate with clearer privacy controls.</p>
              <p>Our mission is to build useful communication features while giving people meaningful control over their conversations and shared content.</p>
              <a className="landing-text-link" href="mailto:support@cloudcomai.com">Talk to the team <ArrowRight size={16} /></a>
            </div>
            <div className="landing-team-panel">
              <span className="landing-team-label">The team</span>
              <div className="landing-team-person"><span>SRK</span><div><strong>Founder</strong><small>Product strategy and platform vision</small></div></div>
              <div className="landing-team-person"><span>KCK</span><div><strong>Co-Founder & Technology Lead</strong><small>Architecture, engineering and security</small></div></div>
            </div>
          </div>
        </section>

        <section className="landing-contact" id="contact">
          <div className="landing-container landing-contact-card">
            <div>
              <span className="landing-eyebrow landing-eyebrow-dark">Contact CloudComAI</span>
              <h2>Questions, feedback or partnership ideas?</h2>
              <p>We would be glad to hear what you are building and how CloudComAI can improve.</p>
            </div>
            <a className="landing-button landing-button-light" href="mailto:support@cloudcomai.com">
              <Mail size={18} /> support@cloudcomai.com
            </a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <div>
            <BrandLogo variant="dark" className="landing-footer-logo" />
            <p>Secure chats. Smart features. Total control.</p>
          </div>
          <div>
            <h3>Explore</h3>
            <a href="#features">Features</a>
            <a href="#security">Security & roadmap</a>
            <a href="#about">About</a>
          </div>
          <div>
            <h3>Legal</h3>
            <button type="button" onClick={() => setLegalDocument('privacy')}>Privacy Policy</button>
            <button type="button" onClick={() => setLegalDocument('terms')}>Terms & Conditions</button>
          </div>
          <div>
            <h3>Account</h3>
            {user ? (
              <button type="button" onClick={onOpenApp}>Open CloudComAI</button>
            ) : (
              <>
                <button type="button" onClick={onLogin}>Log in</button>
                <button type="button" onClick={onRegister}>Register</button>
              </>
            )}
            <a href="mailto:support@cloudcomai.com">Support</a>
          </div>
        </div>
        <div className="landing-container landing-footer-bottom">
          <span>© 2026 CloudComAI. All rights reserved.</span>
          <span>CloudComAI.com</span>
        </div>
      </footer>

      {legalDocument === 'terms' && <TermsModal onClose={() => setLegalDocument(null)} />}
      {legalDocument === 'privacy' && <PrivacyPolicyModal onClose={() => setLegalDocument(null)} />}
    </div>
  );
}
