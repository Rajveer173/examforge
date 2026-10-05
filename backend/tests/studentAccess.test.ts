import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

const app = createApp();

const token = (role: string) =>
  jwt.sign({ sub: 'stu_1', role, type: 'access', jti: 'test' }, env.JWT_ACCESS_SECRET, {
    expiresIn: '5m',
  });

/**
 * testSectionRouter is mounted without a path prefix, so a router-level
 * `use(staffOnly)` on it rejected every student request that reached that point
 * in the stack — which is everything mounted after it. These routes are all
 * student-reachable and must never answer 403 purely because of the caller's role.
 */
const STUDENT_REACHABLE = [
  '/api/results/my',
  '/api/analytics/me',
  '/api/tests/assigned',
  '/api/coding-problems',
  '/api/certificates/mine',
  '/api/leaderboards',
  '/api/my-courses',
  '/api/assignments',
  '/api/notifications/unread-count',
];

describe('student reachability across the API', () => {
  for (const path of STUDENT_REACHABLE) {
    it(`does not 403 a STUDENT on ${path}`, async () => {
      const res = await request(app).get(path).set('Authorization', `Bearer ${token('STUDENT')}`);
      expect(res.status).not.toBe(403);
    });
  }

  it('still refuses a STUDENT on a genuinely staff-only route', async () => {
    const res = await request(app)
      .get('/api/tests/abc/sections')
      .set('Authorization', `Bearer ${token('STUDENT')}`);
    expect(res.status).toBe(403);
  });

  it('still admits a TEACHER to that staff-only route', async () => {
    const res = await request(app)
      .get('/api/tests/abc/sections')
      .set('Authorization', `Bearer ${token('TEACHER')}`);
    expect(res.status).not.toBe(403);
  });
});
