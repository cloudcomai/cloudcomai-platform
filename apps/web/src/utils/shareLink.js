export const buildInvitationUrl = (token, locationRef = globalThis.location) => {
  if (!token) return '';
  const url = new URL(locationRef.href);
  url.searchParams.delete('reset_token');
  url.hash = `invite=${encodeURIComponent(token)}`;
  return url.toString();
};

export const inviteUrlFromResponse = (response, locationRef = globalThis.location) => {
  if (response?.invite_token) return buildInvitationUrl(response.invite_token, locationRef);
  return response?.invite_url || '';
};

export const copyText = async (
  value,
  navigatorRef = globalThis.navigator,
  documentRef = globalThis.document,
) => {
  if (navigatorRef?.clipboard?.writeText) {
    await navigatorRef.clipboard.writeText(value);
    return;
  }
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') {
    throw new Error('Copying is unavailable in this browser');
  }
  const input = documentRef.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  documentRef.body.appendChild(input);
  input.select();
  const copied = documentRef.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Unable to copy link');
};

export const shareOrCopyLink = async ({ title, text, url }) => {
  if (globalThis.navigator?.share) {
    try {
      await globalThis.navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  await copyText(url);
  return 'copied';
};
