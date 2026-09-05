const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export const resolveWebApiBaseUrl = (configuredBaseUrl, pageOrigin) => {
  const origin = new URL(String(pageOrigin ?? '').trim()).origin;
  const configured = String(configuredBaseUrl ?? '').trim() || '/apiapp/api';
  const resolved = new URL(configured, `${origin}/`);

  if (!HTTP_PROTOCOLS.has(resolved.protocol)) {
    throw new TypeError('CloudComAI API URL must use HTTP or HTTPS');
  }

  return resolved.toString().replace(/\/+$/, '');
};
