import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Thin client for any OpenAI-compatible chat completions endpoint. The default
 * is OpenRouter (LLM_API_KEY required); LLM_BASE_URL / LLM_MODEL can instead point
 * at a local Ollama server or another hosted provider.
 *
 * Every caller treats a null result as "model unavailable" and falls back to the
 * built-in engine, so a missing or slow model never breaks a request.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  /** JSON schema the reply must conform to; the parsed object is returned. */
  schema?: { name: string; schema: Record<string, unknown> };
}

// After a connection failure, skip the model for a short while instead of making
// every request wait on a dead endpoint.
const RETRY_AFTER_MS = 30_000;
const TIMEOUT_COOLDOWN_MS = 15_000;
// Rate limited (OpenRouter free tier: ~20/min, 50/day): back off before retrying.
const RATE_LIMIT_COOLDOWN_MS = 60_000;
let unavailableUntil = 0;

const isOpenRouter = () => /openrouter\.ai/.test(env.LLM_BASE_URL);

export function llmEnabled(): boolean {
  return env.LLM_ENABLED && Date.now() >= unavailableUntil;
}

async function complete(messages: ChatMessage[], opts: CompletionOptions): Promise<string | null> {
  if (!llmEnabled()) return null;

  const body: Record<string, unknown> = {
    model: env.LLM_MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1024,
    stream: false,
  };
  // Reasoning models would spend the small token budgets thinking; answer directly.
  if (isOpenRouter()) body.reasoning = { enabled: false };
  if (opts.schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: opts.schema.name, schema: opts.schema.schema, strict: true },
    };
  }

  try {
    const res = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.LLM_API_KEY ? { Authorization: `Bearer ${env.LLM_API_KEY}` } : {}),
        ...(isOpenRouter() ? { 'HTTP-Referer': env.FRONTEND_URL, 'X-Title': 'ExamForge' } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.LLM_TIMEOUT_MS),
    });
    if (!res.ok) {
      if (res.status === 429 || res.status === 402) unavailableUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      logger.warn(`[llm] ${res.status} from model endpoint: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause?.code;
    const timedOut = (err as Error).name === 'TimeoutError';
    if (cause === 'ECONNREFUSED' || cause === 'ENOTFOUND' || cause === 'EAI_AGAIN') {
      unavailableUntil = Date.now() + RETRY_AFTER_MS;
    } else if (timedOut) {
      // A hung model would otherwise stall every later call in the same request.
      unavailableUntil = Date.now() + TIMEOUT_COOLDOWN_MS;
    }
    logger.warn(`[llm] request failed: ${timedOut ? 'timed out' : cause ?? (err as Error).message}`);
    return null;
  }
}

export async function chat(messages: ChatMessage[], opts: Omit<CompletionOptions, 'schema'> = {}) {
  return complete(messages, opts);
}

export async function chatJson<T>(
  messages: ChatMessage[],
  schema: { name: string; schema: Record<string, unknown> },
  opts: Omit<CompletionOptions, 'schema'> = {},
): Promise<T | null> {
  const raw = await complete(messages, { ...opts, schema });
  if (!raw) return null;
  try {
    // Some providers wrap JSON in a code fence even in structured mode.
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
  } catch {
    logger.warn('[llm] reply was not valid JSON');
    return null;
  }
}

export function llmInfo() {
  return {
    enabled: env.LLM_ENABLED,
    model: env.LLM_MODEL,
    baseUrl: env.LLM_BASE_URL,
    reachable: Date.now() >= unavailableUntil,
  };
}
