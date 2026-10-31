export const PRODUCTION_API_BASE_URL = 'https://www.cloudcomai.com/apiapp/api';
export const DEVELOPMENT_API_BASE_URL = 'https://cloudcomai.freedev.app/apiapp/api';

export function resolveApiBaseUrl({ configuredUrl = '', isDevelopment = false } = {}) {
  const configured = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';
  const candidate = configured || (isDevelopment ? DEVELOPMENT_API_BASE_URL : PRODUCTION_API_BASE_URL);

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new TypeError('VITE_API_BASE_URL must be an absolute HTTP(S) URL');
  }

  if (!['https:', ...(isDevelopment ? ['http:'] : [])].includes(url.protocol)) {
    throw new TypeError('The CloudComAI API must use HTTPS outside local development');
  }
  if (!isDevelopment && (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === 'freedev.app' ||
    url.hostname.endsWith('.freedev.app')
  )) {
    throw new TypeError('A development API host cannot be used in a production build');
  }
  if (url.search || url.hash) {
    throw new TypeError('VITE_API_BASE_URL must not contain a query string or fragment');
  }

  return url.toString().replace(/\/+$/, '');
}
