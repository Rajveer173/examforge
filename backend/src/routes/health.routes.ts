import nodemailer from 'nodemailer';
import { Router } from 'express';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cachePing } from '../services/cache.service.js';
import { llmInfo } from '../services/llm.js';
import { logger } from '../utils/logger.js';

export const healthRouter = Router();

const STARTED_AT = new Date().toISOString();

type CheckStatus = 'ok' | 'error' | 'disabled';

const withTimeout = async <T>(work: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const checkDb = async (): Promise<CheckStatus> =>
  withTimeout(
    prisma
      .$queryRaw`SELECT 1`
      .then(() => 'ok' as const)
      .catch((err: Error) => {
        logger.warn('Readiness: database check failed', err.message);
        return 'error' as const;
      }),
    3000,
    'error',
  );

const checkSmtp = async (): Promise<CheckStatus> => {
  if (!env.SMTP_HOST) return 'disabled';
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 3000,
  });
  return withTimeout(
    transporter
      .verify()
      .then(() => 'ok' as const)
      .catch(() => 'error' as const)
      .finally(() => transporter.close()),
    3500,
    'error',
  );
};

/** Liveness must not touch a dependency: it answers "is this process running". */
healthRouter.get('/live', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

/** Readiness answers "can this process serve traffic", so it probes dependencies. */
healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const [db, redis, smtp] = await Promise.all([checkDb(), cachePing(), checkSmtp()]);
    // Only the database is load bearing; a missing cache or mailer degrades
    // features but should not pull the instance out of the load balancer.
    const status = db === 'ok' ? 'ok' : 'error';
    res.status(status === 'ok' ? 200 : 503).json({
      success: status === 'ok',
      data: { status, checks: { db, redis, smtp } },
    });
  }),
);

/** Retained for existing probes that predate live/ready. */
healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const db = await checkDb();
    res.json({
      success: true,
      data: {
        status: db === 'ok' ? 'ok' : 'degraded',
        db,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

healthRouter.get(
  '/db',
  asyncHandler(async (_req, res) => {
    const db = await checkDb();
    res.status(db === 'ok' ? 200 : 503).json({ success: db === 'ok', data: { status: db } });
  }),
);

healthRouter.get('/ai', (_req, res) => {
  const info = llmInfo();
  res.json({
    success: true,
    data: {
      status: !info.enabled ? 'disabled' : info.reachable ? 'configured' : 'unreachable',
      model: info.model,
    },
  });
});

export const versionRouter = Router();

versionRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'examforge-api',
      version: env.APP_VERSION,
      commit: env.GIT_COMMIT,
      startedAt: STARTED_AT,
      node: process.version,
    },
  });
});
