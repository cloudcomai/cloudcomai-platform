const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const normalizeLevel = (value) => { const level = String(value ?? 'info').toLowerCase(); return LEVELS[level] ? level : 'info'; };
let minimumLevel = LEVELS[normalizeLevel(typeof globalThis !== 'undefined' && globalThis.__CLOUDCOMAI_LOG_LEVEL__ || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOG_LEVEL) || 'info')];
const safeValue = (value, depth = 0) => {
  if (depth > 3) return '[MaxDepth]';
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, depth + 1));
  if (typeof value === 'object') { const result = {}; Object.entries(value).slice(0, 50).forEach(([key, item]) => { if (/password|token|authorization|cookie|secret|otp|email|phone|mobile|message|body/i.test(key)) return; result[key] = safeValue(item, depth + 1); }); return result; }
  return String(value);
};
const emit = (level, scope, message, context) => { if (LEVELS[level] < minimumLevel) return; const entry = { timestamp: new Date().toISOString(), level: level.toUpperCase(), app: 'frontend', scope: scope || 'app', message, ...(context ? { context: safeValue(context) } : {}) }; const writer = console[level] || console.log; writer(`[CloudComAI] ${entry.level} [${entry.scope}] ${entry.message}`, entry.context || ''); };
export const logger = {
  setLevel(level) { minimumLevel = LEVELS[normalizeLevel(level)]; },
  getLevel() { return Object.keys(LEVELS).find((key) => LEVELS[key] === minimumLevel) || 'info'; },
  debug(message, context) { emit('debug', 'app', message, context); },
  info(message, context) { emit('info', 'app', message, context); },
  warn(message, context) { emit('warn', 'app', message, context); },
  error(message, context) { emit('error', 'app', message, context); },
  scope(scope) { return { debug: (message, context) => emit('debug', scope, message, context), info: (message, context) => emit('info', scope, message, context), warn: (message, context) => emit('warn', scope, message, context), error: (message, context) => emit('error', scope, message, context), time(label, context) { const startedAt = Date.now(); return { end(extra = {}) { const durationMs = Date.now() - startedAt; emit('info', scope, label, { ...context, ...extra, durationMs }); return durationMs; } }; } }; },
  time(label, context) { return logger.scope('app').time(label, context); },
};
export const createLogger = (scope) => logger.scope(scope);
