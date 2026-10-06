import { ApiError } from './api-error.js';
import { createLogger } from './logger.js';

const log = createLogger('api-client');

const normalizeBaseUrl = (baseUrl) => {
  const value = String(baseUrl ?? '').trim();
  if (!value) throw new TypeError('API base URL is required');
  return value.endsWith('/') ? value : `${value}/`;
};

const addQuery = (url, query) => {
  if (!query) return url;
  const result = new URL(url);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((entry) => result.searchParams.append(key, String(entry)));
    } else {
      result.searchParams.set(key, String(value));
    }
  });
  return result.toString();
};

const parseResponse = async (response, responseType = 'auto') => {
  if (response.status === 204) return null;
  if (responseType === 'blob') return response.blob();
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text || null;
};

const resolveErrorMessage = (payload, response) =>
  payload?.error ?? payload?.message ?? `Request failed with status ${response.status}`;

const createRequestId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `cc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export class ApiClient {
  constructor({
    baseUrl,
    fetchImpl = null,
    tokenProvider = null,
    onUnauthorized = null,
  } = {}) {
    const resolvedFetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
    if (typeof resolvedFetch !== 'function') {
      throw new TypeError('A Fetch-compatible implementation is required');
    }
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.fetchImpl = resolvedFetch;
    this.tokenProvider = tokenProvider;
    this.onUnauthorized = onUnauthorized;
  }

  async request(path, options = {}) {
    const {
      method = 'GET',
      query,
      body,
      headers = {},
      auth = true,
      signal,
      responseType = 'auto',
    } = options;
    const requestHeaders = new Headers(headers);
    let requestBody = body;
    const requestId = requestHeaders.get('X-Request-Id') || createRequestId();
    requestHeaders.set('X-Request-Id', requestId);

    // Multipart bodies can originate in another browser realm (iframe/window) or
    // from React Native's FormData implementation. instanceof FormData is not
    // reliable across those environments and caused uploads to be JSON encoded.
    const isFormData =
      body !== undefined &&
      body !== null &&
      typeof body === 'object' &&
      ((typeof FormData !== 'undefined' && body instanceof FormData) ||
        Object.prototype.toString.call(body) === '[object FormData]' ||
        typeof body.append === 'function' && (
          typeof body.entries === 'function' ||
          Array.isArray(body._parts)
        ));
    if (body !== undefined && body !== null && !isFormData) {
      requestHeaders.set('Content-Type', 'application/json');
      requestBody = JSON.stringify(body);
    }

    if (auth && this.tokenProvider && !requestHeaders.has('Authorization')) {
      const token = await this.tokenProvider();
      if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    const startedAt = Date.now();
    let response;
    let requestUrl;
    try {
      requestUrl = addQuery(new URL(path, this.baseUrl).toString(), query);
      log.debug('API request started', { method, path, requestId });
      response = await this.fetchImpl(requestUrl, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal,
      });
    } catch (error) {
      log.error('API request failed before response', {
        method,
        path,
        requestId,
        durationMs: Date.now() - startedAt,
        error,
      });
      if (error?.name === 'AbortError') throw error;
      throw new ApiError(
        `Unable to reach the CloudComAI API${error?.message ? `: ${error.message}` : ''}`,
        {
          code: 'NETWORK_ERROR',
          details: error,
        },
      );
    }

    const payload = await parseResponse(response, response.ok ? responseType : 'auto');
    const context = {
      method,
      path,
      requestId,
      status: response.status,
      durationMs: Date.now() - startedAt,
    };
    if (!response.ok) {
      log.warn('API request returned an error response', context);
      if (response.status === 401 && auth && this.onUnauthorized) {
        // An in-flight request can finish after sign-in or session rotation.
        // Only expire the credentials that actually received this rejection.
        const currentToken = this.tokenProvider ? await this.tokenProvider() : null;
        if (!this.tokenProvider || requestHeaders.get('Authorization') === (currentToken ? `Bearer ${currentToken}` : null)) {
          await this.onUnauthorized();
        }
      }
      throw new ApiError(resolveErrorMessage(payload, response), {
        status: response.status,
        code: payload?.code ?? null,
        details: payload,
        response,
      });
    }
    log.info('API request completed', context);
    return { data: payload, status: response.status, headers: response.headers };
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, { ...options, method: 'POST', body });
  }

  put(path, body, options = {}) {
    return this.request(path, { ...options, method: 'PUT', body });
  }

  delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}

export const createApiClient = (options) => new ApiClient(options);
