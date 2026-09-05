import { ApiError } from './api-error.js';

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

export class ApiClient {
  constructor({
    baseUrl,
    fetchImpl = globalThis.fetch,
    tokenProvider = null,
    onUnauthorized = null,
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('A Fetch-compatible implementation is required');
    }
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
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

    const isFormData =
      typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && body !== null && !isFormData) {
      requestHeaders.set('Content-Type', 'application/json');
      requestBody = JSON.stringify(body);
    }

    if (auth && this.tokenProvider) {
      const token = await this.tokenProvider();
      if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    let response;
    let requestUrl;
    try {
      requestUrl = addQuery(new URL(path, this.baseUrl).toString(), query);

      console.log('[CloudComAI API Request]', {
        method,
        baseUrl: this.baseUrl,
        path,
        requestUrl,
      });

      response = await this.fetchImpl(requestUrl, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal,
      });
    } catch (error) {
      console.error('[CloudComAI API Error]', {
        method,
        baseUrl: this.baseUrl,
        path,
        requestUrl,
        message: error?.message,
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

    const payload = await parseResponse(response, responseType);
    if (!response.ok) {
      if (response.status === 401 && auth && this.onUnauthorized) {
        await this.onUnauthorized();
      }
      throw new ApiError(resolveErrorMessage(payload, response), {
        status: response.status,
        code: payload?.code ?? null,
        details: payload,
        response,
      });
    }
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
