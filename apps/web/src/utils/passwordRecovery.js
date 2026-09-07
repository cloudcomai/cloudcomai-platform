// Accept links already emailed by older releases as well as fragment-based links.
export function passwordResetLink(href) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const params = url.searchParams.has('reset_token') ? url.searchParams : fragment;
  return {
    present: params.has('reset_token') || url.hash === '#reset',
    token: (params.get('reset_token') || '').trim(),
  };
}

export function privatePasswordResetUrl(href) {
  const url = new URL(href);
  if (url.searchParams.has('reset_token')) {
    const { token } = passwordResetLink(href);
    url.searchParams.delete('reset_token');
    url.hash = `reset_token=${encodeURIComponent(token)}`;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export const isPasswordResetToken = token => /^[A-Za-z0-9_-]{43}$/.test(token);
