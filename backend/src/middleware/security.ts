import { NextFunction, Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import { allowedOrigins, isProduction } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * The API returns JSON, never HTML, so its own content policy can be the
 * strictest one that exists: nothing may load, nothing may frame it, and a
 * reflected-content bug cannot turn into script execution. The policy that
 * governs the application shell lives in nginx/nginx.conf, because nginx is
 * what serves index.html; it is documented in docs/SECURITY.md.
 */
export const apiHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
      'frame-ancestors': ["'none'"],
      'img-src': ["'none'"],
      'script-src': ["'none'"],
      'style-src': ["'none'"],
      'connect-src': ["'none'"],
      'sandbox': [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  // Two years with preload is the threshold browsers require for the HSTS
  // preload list. It is only emitted over HTTPS, so plain-HTTP dev is unaffected.
  hsts: isProduction
    ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
    : false,
  frameguard: { action: 'deny' },
  noSniff: true,
  hidePoweredBy: true,
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  xssFilter: false,
});

/** Browser features the API has no use for, denied outright. */
export const permissionsPolicy = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  );
  next();
};

/**
 * The origin this very request was addressed to, e.g. "http://localhost:8081".
 *
 * `req.protocol` and `req.get('host')` already account for X-Forwarded-Proto and
 * the Host nginx passes through, bounded by the trust-proxy setting in app.ts.
 * Returns null when the Host header is missing or malformed, which sends the
 * caller back to the explicit allowlist rather than guessing.
 */
const requestOrigin = (req: Request): string | null => {
  const host = req.get('host');
  if (!host) return null;
  try {
    return new URL(`${req.protocol}://${host}`).origin;
  } catch {
    return null;
  }
};

/**
 * An Origin is acceptable when it is on the configured allowlist, or when it is
 * simply the origin this request was already sent to.
 *
 * The second clause is what makes the bundled deployment work. nginx serves the
 * SPA and reverse-proxies /api on one origin, so a login POST from the app is
 * same-origin — yet browsers still attach an Origin header to it, and without
 * this the request was rejected as cross-site unless the deploy port happened to
 * be listed in CORS_EXTRA_ORIGINS. Matching against the request's own host makes
 * that work on whatever port the app is actually served from.
 *
 * It gives nothing away: a page on attacker.example cannot make the browser send
 * `Origin: attacker.example` to a request addressed to our host — the Origin
 * header is set by the browser and is not writable by page script. Anything
 * genuinely cross-origin still has to be on the allowlist.
 */
const originAllowed = (origin: string, req?: Request): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  return req ? origin === requestOrigin(req) : false;
};

export const corsOptions: CorsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 600,
};

// The request-aware form of `cors`, so the origin check can see the host the
// request was addressed to and recognise the same-origin case above.
export const corsMiddleware = cors((req, callback) => {
  const origin = req.headers.origin;

  // Non-browser clients (curl, server-to-server) send no Origin at all.
  if (!origin) return callback(null, { ...corsOptions, origin: true });

  if (originAllowed(origin, req as Request)) {
    return callback(null, { ...corsOptions, origin: true });
  }

  logger.warn(`Blocked cross-origin request from ${origin}`);
  callback(new AppError(403, 'Origin not allowed', undefined, 'ORIGIN_BLOCKED'));
});

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence for the cookie-borne refresh flow.
 *
 * The refresh cookie is SameSite=Strict, which already stops a cross-site page
 * from having the browser attach it. This is the second, independent layer: any
 * state-changing request that arrives *with cookies* must also declare an Origin
 * (or Referer) that is on the allowlist. Requests authenticated purely by a
 * bearer token carry no cookie and are untouched, so CLI and server-to-server
 * callers keep working.
 *
 * A cross-site form post — the classic CSRF shape, which cannot set headers —
 * still sends an Origin in every browser that ships SameSite, so it is rejected
 * here even if the cookie policy were somehow bypassed.
 */
export const csrfGuard = (req: Request, _res: Response, next: NextFunction): void => {
  if (!MUTATING.has(req.method)) return next();

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return next();

  const origin = req.get('origin');
  if (origin) {
    if (originAllowed(origin, req)) return next();
    throw new AppError(403, 'Cross-site request rejected', undefined, 'CSRF_ORIGIN_MISMATCH');
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      if (originAllowed(new URL(referer).origin, req)) return next();
    } catch {
      // A malformed Referer is treated as absent and falls through to rejection.
    }
    throw new AppError(403, 'Cross-site request rejected', undefined, 'CSRF_ORIGIN_MISMATCH');
  }

  throw new AppError(
    403,
    'Missing Origin header on a cookie-authenticated request',
    undefined,
    'CSRF_ORIGIN_MISSING',
  );
};

/** Rejects request bodies whose declared type the API does not parse. */
export const enforceContentType = (req: Request, _res: Response, next: NextFunction): void => {
  if (!MUTATING.has(req.method)) return next();
  const length = req.get('content-length');
  if (!length || length === '0') return next();

  const type = req.get('content-type') ?? '';
  const accepted =
    type.startsWith('application/json') ||
    type.startsWith('application/x-www-form-urlencoded') ||
    type.startsWith('multipart/form-data');
  if (!accepted) {
    throw new AppError(415, `Unsupported content type: ${type || 'none'}`, undefined, 'UNSUPPORTED_MEDIA_TYPE');
  }
  next();
};
