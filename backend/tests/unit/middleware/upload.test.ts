// Unit tests for src/middleware/upload.ts — multer in memory mode, single
// `file` field, coarse size cap of 2x MAX_RECEIPT_SIZE_BYTES (the precise
// type/size checks live in receiptService and are covered by integration tests).
import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { uploadReceipt } from '../../../src/middleware/upload';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { env } from '../../../src/lib/env';

const app = express();
app.post('/upload', uploadReceipt, (req, res) => {
  res.json({
    file: req.file && { name: req.file.originalname, mime: req.file.mimetype, size: req.file.size, inMemory: Buffer.isBuffer(req.file.buffer), path: req.file.path ?? null },
    body: req.body,
  });
});
app.use(errorHandler);

describe('uploadReceipt middleware', () => {
  it('keeps the uploaded file in memory (never on disk) and parses text fields', async () => {
    const res = await request(app)
      .post('/upload')
      .field('claimItemId', 'item-1')
      .attach('file', Buffer.from('fake-png-bytes'), { filename: 'receipt.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.file).toEqual({ name: 'receipt.png', mime: 'image/png', size: 14, inMemory: true, path: null });
    expect(res.body.body).toEqual({ claimItemId: 'item-1' });
  });

  it('passes through with no file (the route itself reports "file is required")', async () => {
    const res = await request(app).post('/upload').field('claimItemId', 'item-1');
    expect(res.status).toBe(200);
    expect(res.body.file).toBeUndefined();
  });

  it('rejects a file sent under the wrong field name', async () => {
    const res = await request(app).post('/upload').attach('receipt', Buffer.from('x'), 'receipt.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Unexpected file field' });
  });

  it('rejects more than one file', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('a'), 'a.png')
      .attach('file', Buffer.from('b'), 'b.png');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a file over the 2x size cap', async () => {
    const tooBig = Buffer.alloc(env.maxReceiptSizeBytes * 2 + 1);
    const res = await request(app).post('/upload').attach('file', tooBig, { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'File too large' });
  });

  it('lets a file just over the 5MB limit through to the service-level check', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.alloc(env.maxReceiptSizeBytes + 1), { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.file.size).toBe(env.maxReceiptSizeBytes + 1);
  });
});
