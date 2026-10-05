import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';

/**
 * Zod strips keys a schema does not declare, so a body-only schema parses to
 * `{ body }`. Writing that result straight back onto the request wiped
 * req.params/req.query, which 500'd every route pairing a body-only schema with
 * a route param — assignment submit, update and grade all did exactly that.
 */
const bodyOnly = z.object({ body: z.object({ answerText: z.string().optional() }) });

const app = express();
app.use(express.json());
app.post('/items/:id', validate(bodyOnly), (req, res) => {
  res.json({ id: req.params.id, q: req.query.page ?? null, body: req.body });
});

describe('validate middleware', () => {
  it('preserves route params when the schema only declares a body', async () => {
    const res = await request(app).post('/items/abc123').send({ answerText: 'hi' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('abc123');
  });

  it('preserves the query string when the schema only declares a body', async () => {
    const res = await request(app).post('/items/abc123?page=2').send({});
    expect(res.status).toBe(200);
    expect(res.body.q).toBe('2');
  });

  it('still applies the parsed body', async () => {
    const res = await request(app).post('/items/x').send({ answerText: 'kept', extra: 'dropped' });
    expect(res.body.body).toEqual({ answerText: 'kept' });
  });

  it('still rejects a body that fails validation', async () => {
    const res = await request(app).post('/items/x').send({ answerText: 42 });
    expect(res.status).toBe(400);
  });
});
