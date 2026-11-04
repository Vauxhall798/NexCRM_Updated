import http from 'node:http';
import { URL } from 'node:url';

export interface Request {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string | undefined>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  user?: any;
}

export interface Response {
  statusCode: number;
  status: (code: number) => Response;
  json: (payload: unknown) => void;
  headersSent: boolean;
}

export type NextFunction = () => void;
export type Handler = (req: any, res: Response, next: NextFunction) => any;

interface RouteLayer {
  method: string; // 'ALL' | 'GET' | 'POST' | 'PUT' | 'DELETE'
  prefix: string;
  pattern: string;
  handlers: Handler[];
  subRouter?: RouterInstance;
}

function matchPath(pattern: string, actualPath: string): Record<string, string> | null {
  const cleanPattern = pattern.replace(/\/+$/, '') || '/';
  const cleanActual = actualPath.replace(/\/+$/, '') || '/';

  const pParts = cleanPattern.split('/').filter(Boolean);
  const aParts = cleanActual.split('/').filter(Boolean);

  if (pParts.length !== aParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < pParts.length; i++) {
    const p = pParts[i];
    const a = aParts[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(a);
    } else if (p !== a) {
      return null;
    }
  }
  return params;
}

export class RouterInstance {
  public layers: RouteLayer[] = [];

  use(arg1: string | Handler | RouterInstance, arg2?: Handler | RouterInstance): void {
    if (typeof arg1 === 'function') {
      this.layers.push({ method: 'USE', prefix: '', pattern: '', handlers: [arg1] });
    } else if (typeof arg1 === 'string' && arg2 instanceof RouterInstance) {
      this.layers.push({
        method: 'ROUTER',
        prefix: arg1.replace(/\/+$/, ''),
        pattern: '',
        handlers: [],
        subRouter: arg2,
      });
    } else if (typeof arg1 === 'string' && typeof arg2 === 'function') {
      this.layers.push({
        method: 'USE',
        prefix: arg1.replace(/\/+$/, ''),
        pattern: '',
        handlers: [arg2],
      });
    }
  }

  get(pattern: string, ...handlers: Handler[]): void {
    this.layers.push({ method: 'GET', prefix: '', pattern, handlers });
  }

  post(pattern: string, ...handlers: Handler[]): void {
    this.layers.push({ method: 'POST', prefix: '', pattern, handlers });
  }

  put(pattern: string, ...handlers: Handler[]): void {
    this.layers.push({ method: 'PUT', prefix: '', pattern, handlers });
  }

  delete(pattern: string, ...handlers: Handler[]): void {
    this.layers.push({ method: 'DELETE', prefix: '', pattern, handlers });
  }
}

export function Router(): RouterInstance {
  return new RouterInstance();
}

export class AppInstance extends RouterInstance {
  async dispatch(req: Request, res: Response): Promise<void> {
    const queue: Array<{ handler: Handler; params?: Record<string, string> }> = [];

    const collectHandlers = (router: RouterInstance, mountPrefix: string) => {
      for (const layer of router.layers) {
        if (layer.method === 'USE') {
          if (!layer.prefix || req.path.startsWith(layer.prefix)) {
            for (const h of layer.handlers) {
              queue.push({ handler: h });
            }
          }
        } else if (layer.method === 'ROUTER' && layer.subRouter) {
          const fullPrefix = `${mountPrefix}${layer.prefix}`;
          if (req.path === fullPrefix || req.path.startsWith(`${fullPrefix}/`)) {
            collectHandlers(layer.subRouter, fullPrefix);
          }
        } else if (layer.method === req.method) {
          const fullPattern =
            layer.pattern === '/' ? mountPrefix || '/' : `${mountPrefix}${layer.pattern}`;
          const matchedParams = matchPath(fullPattern, req.path);
          if (matchedParams) {
            for (const h of layer.handlers) {
              queue.push({ handler: h, params: matchedParams });
            }
          }
        }
      }
    };

    collectHandlers(this, '');

    if (queue.length === 0) {
      res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
      return;
    }

    let idx = 0;
    const next = async (): Promise<void> => {
      if (res.headersSent || idx >= queue.length) return;
      const item = queue[idx++];
      if (item.params) {
        req.params = { ...req.params, ...item.params };
      }
      let nextCalled = false;
      const triggerNext = () => {
        nextCalled = true;
      };
      await item.handler(req, res, triggerNext);
      if (nextCalled && !res.headersSent) {
        await next();
      }
    };

    try {
      await next();
    } catch (err) {
      console.error('Unhandled API Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async inject(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<{ status: number; body: any }> {
    const parsedUrl = new URL(options.url, 'http://localhost');
    const query: Record<string, string> = {};
    parsedUrl.searchParams.forEach((v, k) => {
      query[k] = v;
    });

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(options.headers || {})) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const req: Request = {
      method: options.method.toUpperCase(),
      url: options.url,
      path: parsedUrl.pathname,
      headers: normalizedHeaders,
      params: {},
      query,
      body: options.body || {},
    };

    let responseStatus = 200;
    let responseBody: any = null;
    let sent = false;

    const res: Response = {
      get statusCode() {
        return responseStatus;
      },
      set statusCode(val: number) {
        responseStatus = val;
      },
      get headersSent() {
        return sent;
      },
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(payload: unknown) {
        sent = true;
        responseBody = payload;
      },
    };

    await this.dispatch(req, res);
    return { status: responseStatus, body: responseBody };
  }

  listen(port: number, callback?: () => void): http.Server {
    const server = http.createServer(async (incoming, serverRes) => {
      // CORS headers
      serverRes.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
      serverRes.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      serverRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      serverRes.setHeader('Access-Control-Allow-Credentials', 'true');

      if (incoming.method === 'OPTIONS') {
        serverRes.writeHead(204);
        serverRes.end();
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of incoming) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let parsedBody: any = {};
      if (rawBody.trim()) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = {};
        }
      }

      const parsedUrl = new URL(incoming.url || '/', `http://localhost:${port}`);
      const query: Record<string, string> = {};
      parsedUrl.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(incoming.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
      }

      const req: Request = {
        method: (incoming.method || 'GET').toUpperCase(),
        url: incoming.url || '/',
        path: parsedUrl.pathname,
        headers,
        params: {},
        query,
        body: parsedBody,
      };

      let statusCode = 200;
      let sent = false;

      const res: Response = {
        get statusCode() {
          return statusCode;
        },
        set statusCode(val: number) {
          statusCode = val;
        },
        get headersSent() {
          return sent;
        },
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: unknown) {
          if (sent) return;
          sent = true;
          const bodyStr = JSON.stringify(payload);
          serverRes.writeHead(statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
          });
          serverRes.end(bodyStr);
        },
      };

      await this.dispatch(req, res);
    });

    return server.listen(port, callback);
  }
}

export function createApp(): AppInstance {
  return new AppInstance();
}

