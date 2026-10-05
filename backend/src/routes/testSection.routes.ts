import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { z } from 'zod';
import * as testSectionService from '../services/testSection.service.js';

const staffOnly = requireRole('ADMIN', 'TEACHER');

export const testSectionRouter = Router();

/**
 * This router is mounted WITHOUT a path prefix (see routes/index.ts), because
 * its routes live under two unrelated prefixes: /tests/:testId/sections and
 * /sections/:id.
 *
 * That makes a router-level `use(requireAuth, staffOnly)` actively dangerous:
 * a prefix-less router receives every request, and a path-less `use` runs on
 * all of them whether or not one of its own routes matches. The staff guard
 * therefore rejected every student request that reached this point in the
 * stack, taking out tests, attempts, results, coding problems, certificates,
 * leaderboards, proctoring and uploads — all of which are mounted after it.
 *
 * The guards belong on the routes instead, where they only run on a match.
 */
const staffRoute = [requireAuth, staffOnly] as const;

testSectionRouter.get('/tests/:testId/sections', ...staffRoute, asyncHandler(async (req, res) => {
  const sections = await testSectionService.listSections(req.params.testId);
  res.json({ success: true, data: { sections } });
}));

testSectionRouter.post('/tests/:testId/sections', ...staffRoute, asyncHandler(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    durationMinutes: z.coerce.number().int().min(0).optional(),
    marks: z.coerce.number().min(0).optional(),
  });
  const input = schema.parse(req.body);
  const section = await testSectionService.createSection(req.params.testId, input);
  res.status(201).json({ success: true, data: { section } });
}));

testSectionRouter.put('/sections/:id', ...staffRoute, asyncHandler(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    durationMinutes: z.coerce.number().int().min(0).optional(),
    marks: z.coerce.number().min(0).optional(),
  });
  const input = schema.parse(req.body);
  const section = await testSectionService.updateSection(req.params.id, input);
  res.json({ success: true, data: { section } });
}));

testSectionRouter.delete('/sections/:id', ...staffRoute, asyncHandler(async (req, res) => {
  await testSectionService.deleteSection(req.params.id);
  res.json({ success: true, data: null });
}));

testSectionRouter.put('/tests/:testId/sections/reorder', ...staffRoute, asyncHandler(async (req, res) => {
  const schema = z.object({ sectionIds: z.array(z.string()).min(1) });
  const { sectionIds } = schema.parse(req.body);
  const result = await testSectionService.reorderSections(req.params.testId, sectionIds);
  res.json({ success: true, data: result });
}));
