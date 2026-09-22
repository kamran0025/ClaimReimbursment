import multer from 'multer';
import { env } from '../lib/env';

// Memory storage: the file is validated (mime + size, in receiptService) and
// handed to the `Storage` abstraction as a `Buffer` — multer never writes to
// disk itself. `limits.fileSize` is a coarse first gate; the precise 5MB
// check + allowed-mime-type check happen again in receiptService so the
// error code/message match the documented contract exactly.
export const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxReceiptSizeBytes * 2 },
}).single('file');
