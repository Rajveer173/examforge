import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('origin handling on a mutating request', () => {
  const post = (headers: Record<string, string>) =>
    request(app).post('/api/auth/login').set(headers).send({ email: 'x@y.z', password: 'nope' });

  it('accepts a same-origin POST on a port that is not in the allowlist', async () => {
    const res = await post({ Host: 'localhost:8081', Origin: 'http://localhost:8081' });
    expect(res.status).not.toBe(403);
  });

  it('accepts the 127.0.0.1 spelling when that is the host addressed', async () => {
    const res = await post({ Host: '127.0.0.1:8081', Origin: 'http://127.0.0.1:8081' });
    expect(res.status).not.toBe(403);
  });

  it('accepts a same-origin POST that already carries cookies (the csrf path)', async () => {
    const res = await post({
      Host: 'localhost:8081',
      Origin: 'http://localhost:8081',
      Cookie: 'refreshToken=abc',
    });
    expect(res.status).not.toBe(403);
  });

  it('still rejects a genuinely cross-origin POST', async () => {
    const res = await post({ Host: 'localhost:8081', Origin: 'http://attacker.example' });
    expect(res.status).toBe(403);
  });

  it('still rejects a cross-origin POST that carries cookies', async () => {
    const res = await post({
      Host: 'localhost:8081',
      Origin: 'http://attacker.example',
      Cookie: 'refreshToken=abc',
    });
    expect(res.status).toBe(403);
  });
});
