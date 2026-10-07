import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const csvList = (fallback: string[]) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        : fallback,
    );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  // Extra browser origins allowed to call the API (comma separated). FRONTEND_URL is
  // always allowed and does not need repeating here.
  CORS_EXTRA_ORIGINS: csvList([]),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // Redis is optional: when disabled the cache degrades to a no-op and readiness
  // reports redis as "disabled" rather than failing.
  REDIS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Pretrained model behind any OpenAI-compatible API. Defaults to a local Ollama
  // server; when it is unreachable the AI features fall back to the built-in engine.
  LLM_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  LLM_BASE_URL: z.string().url().default('http://localhost:11434/v1'),
  LLM_MODEL: z.string().min(1).default('qwen2.5:3b'),
  LLM_API_KEY: z.string().optional().default(''),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(80_000),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_BUCKET: z.string().default('examforge'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('ExamForge <no-reply@examforge.dev>'),
  SMTP_REJECT_UNAUTHORIZED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  ENABLE_METRICS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Restricts /api/metrics to a bearer token when set; unset means the endpoint is
  // reachable by anyone who can route to the port, so keep it internal-only.
  METRICS_TOKEN: z.string().default(''),

  // Security tuning
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(64).default(10),
  LOGIN_MAX_FAILURES: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCKOUT_BASE_SECONDS: z.coerce.number().int().min(10).default(60),
  LOGIN_LOCKOUT_MAX_SECONDS: z.coerce.number().int().min(60).default(60 * 60),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(10).default(600),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).default(25 * 1024 * 1024),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15_000),
  // Number of proxies in front of the app; 0 disables X-Forwarded-For trust so a
  // client cannot spoof its own IP into the rate limiter.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_DOMAIN: z.string().optional(),

  APP_VERSION: z.string().default('0.1.0'),
  GIT_COMMIT: z.string().default('unknown'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const allowedOrigins: string[] = [env.FRONTEND_URL, ...env.CORS_EXTRA_ORIGINS];
