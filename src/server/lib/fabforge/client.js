import http from 'http';
import https from 'https';
import { URL } from 'url';

export class FabForgeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const configuration = () => ({
  url: process.env.FABFORGE_URL || '',
  workspaceId: process.env.FABFORGE_WORKSPACE_ID || '',
  token: process.env.FABFORGE_TOKEN || '',
  resourceId: process.env.FABFORGE_RESOURCE_ID || ''
});

export const segment = (value) => {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 500 ||
    value === '.' ||
    value === '..' ||
    /[\/\\?#]/.test(value) ||
    Array.from(value).some((char) => char.charCodeAt(0) < 32)
  ) {
    throw new FabForgeError('Invalid FabForge identifier or path segment.');
  }
  return encodeURIComponent(value);
};

// Server-held credentials, fixed origin, no redirects, bounded response and timeout.
export const request = (path, { method = 'GET', body, query = {}, raw = false } = {}) => new Promise((resolve, reject) => {
    const config = configuration();
    if (!config.url || !config.workspaceId || !config.token) {
      reject(
        new FabForgeError('Configure FABFORGE_URL, FABFORGE_WORKSPACE_ID and FABFORGE_TOKEN on the CNCjs server.', 503)
      );
      return;
    }
    let url;
    try {
      const base = new URL(config.url);
      if (
        !['https:', 'http:'].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        !['', '/'].includes(base.pathname)
      ) {
        throw new Error('Expected an HTTP(S) origin without credentials or a path.');
      }
      url = new URL(`/api/fabrication/v0/${path}`, base);
      if (url.origin !== base.origin || !url.pathname.startsWith('/api/fabrication/v0/')) {
        throw new Error('Invalid API path.');
      }
      url.searchParams.set('workspaceId', config.workspaceId);
      Object.keys(query).forEach((key) => url.searchParams.set(key, query[key]));
    } catch (err) {
      reject(new FabForgeError('Invalid FabForge server URL or request path.', 503));
      return;
    }
    const payload = body ? JSON.stringify({ ...body, workspaceId: config.workspaceId }) : null;
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method,
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: raw ? 'text/plain, application/octet-stream' : 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        const chunks = [];
        let length = 0;
        res.on('data', (chunk) => {
          length += chunk.length;
          if (length > 2 * 1024 * 1024) {
            req.destroy(new FabForgeError('FabForge response exceeds the 2 MiB integration limit.', 413));
            return;
          }
          chunks.push(chunk);
        });
        res.on('error', () => reject(new FabForgeError('FabForge response was interrupted.', 502)));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(
              new FabForgeError(
                `FabForge returned HTTP ${res.statusCode}. Check workspace access, token scopes and job state.`,
                res.statusCode === 404 ? 404 : 502
              )
            );
            return;
          }
          const bytes = Buffer.concat(chunks);
          if (raw) {
            const decoded = bytes.toString('utf8');
            if (!Buffer.from(decoded, 'utf8').equals(bytes)) {
              reject(new FabForgeError('G-code must be valid UTF-8 text.', 422));
              return;
            }
            resolve(decoded);
            return;
          }
          try {
            const json = JSON.parse(bytes.toString('utf8'));
            if (!json || !Object.prototype.hasOwnProperty.call(json, 'data')) {
              throw new Error();
            }
            resolve(json.data);
          } catch (err) {
            reject(new FabForgeError('FabForge returned an invalid API response.', 502));
          }
        });
      }
    );
    const timeout = setTimeout(() => req.destroy(new FabForgeError('FabForge request timed out.', 504)), 15000);
    req.on('close', () => clearTimeout(timeout));
    req.on('error', (err) => reject(err instanceof FabForgeError ? err : new FabForgeError('Cannot reach FabForge.', 502)));
    req.end(payload);
  });
