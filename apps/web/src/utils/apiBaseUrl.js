export function resolveApiBaseUrl({ configuredUrl = '' } = {}) {
  const candidate = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  if (!candidate) {
    throw new TypeError('VITE_API_BASE_URL is required. Configure the production API URL before building the web app.');
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError('VITE_API_BASE_URL must be an absolute HTTPS URL');
  }

  if (url.protocol !== 'https:') {
    throw new TypeError('The CloudComAI API must use HTTPS');
  }
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === 'freedev.app' ||
    url.hostname.endsWith('.freedev.app')
  ) {
    throw new TypeError('A non-production API host cannot be used');
  }
  if (url.search || url.hash) {
    throw new TypeError('VITE_API_BASE_URL must not contain a query string or fragment');
  }

  return url.toString().replace(/\/+$/, '');
}
