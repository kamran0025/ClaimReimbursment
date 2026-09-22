import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Storage, StoredFile } from './storage';

/**
 * Local-disk implementation. Files live under a gitignored `uploads/`
 * directory (never served statically — always read through the authenticated
 * download endpoint, see routes/claims.ts). `storagePath` is a filename only
 * (no client-controlled path components), so path traversal is impossible.
 */
export class LocalDiskStorage implements Storage {
  constructor(private readonly rootDir: string) {}

  private async ensureRoot(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  async save(buffer: Buffer, suggestedName: string): Promise<StoredFile> {
    await this.ensureRoot();
    const ext = path.extname(suggestedName).slice(0, 10);
    const storagePath = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(this.rootDir, storagePath), buffer);
    return { storagePath };
  }

  async read(storagePath: string): Promise<Buffer> {
    return fs.readFile(this.resolve(storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    await fs.rm(this.resolve(storagePath), { force: true });
  }

  private resolve(storagePath: string): string {
    const base = path.basename(storagePath);
    return path.join(this.rootDir, base);
  }
}
