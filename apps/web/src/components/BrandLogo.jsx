import React from 'react';

const logoFiles = {
  light: {
    small: 'brand/cloudcomai-logo-light-320.png',
    large: 'brand/cloudcomai-logo-light-640.png',
  },
  dark: {
    small: 'brand/cloudcomai-logo-dark-320.png',
    large: 'brand/cloudcomai-logo-dark-640.png',
  },
};

export default function BrandLogo({ variant = 'dark', className = '' }) {
  const files = logoFiles[variant] || logoFiles.dark;
  const assetUrl = path => `${import.meta.env.BASE_URL}${path}`;

  return (
    <img
      className={`brand-image ${className}`.trim()}
      src={assetUrl(files.small)}
      srcSet={`${assetUrl(files.small)} 320w, ${assetUrl(files.large)} 640w`}
      sizes="(max-width: 480px) 220px, 320px"
      width="320"
      height="108"
      alt="CloudComAI — Secure Chats, Smart Features, Total Control"
      decoding="async"
    />
  );
}
