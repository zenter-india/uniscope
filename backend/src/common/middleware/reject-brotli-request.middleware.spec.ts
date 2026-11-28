import { Body, Controller, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import express from 'express';
import request from 'supertest';
import { rejectBrotliRequestBodies } from './reject-brotli-request.middleware.js';

@Controller('probe')
class ProbeController {
  @Post()
  echo(@Body() body: unknown) {
    return { received: body };
  }
}

/**
 * The real app is a Nest app, which registers its own body parser during
 * init. This builds the app in the same order main.ts does, so the guard is
 * proven to run ahead of Nest's parser and not just ahead of a plain one.
 */
describe('rejectBrotliRequestBodies inside a Nest app (same order as main.ts)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      rawBody: true,
    });
    app.use(rejectBrotliRequestBodies);
    app.useBodyParser('json', { limit: '10mb' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 415, not a decoder error, for a Brotli-marked body', async () => {
    const res = await request(app.getHttpServer())
      .post('/probe')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'br')
      .send(Buffer.from('x'));
    expect(res.status).toBe(415);
  });

  it('still parses a normal JSON body', async () => {
    const res = await request(app.getHttpServer())
      .post('/probe')
      .send({ ok: true });
    expect(res.status).toBe(201);
    expect((res.body as { received: unknown }).received).toEqual({ ok: true });
  });
});

/** Mirrors main.ts: the guard is registered before the JSON body parser. */
function buildApp() {
  const app = express();
  app.use(rejectBrotliRequestBodies);
  app.use(express.json({ limit: '10mb' }));
  app.post('/echo', (req, res) => {
    res.json({ received: req.body as unknown });
  });
  return app;
}

describe('rejectBrotliRequestBodies', () => {
  it('answers 415 for a body marked Content-Encoding: br', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'br')
      .send(Buffer.from('x'));
    expect(res.status).toBe(415);
    expect((res.body as { statusCode: number }).statusCode).toBe(415);
  });

  it('catches br anywhere in a comma-separated list, in any case', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip, BR')
      .send(Buffer.from('x'));
    expect(res.status).toBe(415);
  });

  it('lets a normal JSON body through', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .send({ hello: 'world' });
    expect(res.status).toBe(200);
    expect((res.body as { received: unknown }).received).toEqual({
      hello: 'world',
    });
  });

  it('does not touch a request with no Content-Encoding', async () => {
    const res = await request(buildApp()).get('/missing');
    expect(res.status).toBe(404);
  });
});
