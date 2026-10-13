// addReceipt stores the file before writing its DB row — if that write fails,
// the stored file must be deleted again so nothing is left orphaned. Prisma
// and storage are mocked here because the point is forcing the DB failure.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimStatus, Role } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  prisma: { claim: { findUnique: vi.fn() }, claimItem: { findFirst: vi.fn() }, $transaction: vi.fn() },
  storage: { save: vi.fn(), delete: vi.fn(), read: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../src/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../../src/services/storage', () => ({ storage: mocks.storage }));
vi.mock('../../src/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('../../src/services/claimQueryService', () => ({
  loadClaimForMutation: vi.fn().mockResolvedValue({}),
  buildClaimDetail: vi.fn().mockReturnValue({ id: 'c1' }),
}));

import { addReceipt } from '../../src/services/receiptService';

const user = { id: 'u1', role: Role.CLAIMANT };
const file = { originalname: 'receipt.png', mimetype: 'image/png', size: 10, buffer: Buffer.from('png') };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.claim.findUnique.mockResolvedValue({ id: 'c1', claimantId: 'u1', status: ClaimStatus.DRAFT });
  mocks.storage.save.mockResolvedValue({ storagePath: 'stored-file.png' });
  mocks.storage.delete.mockResolvedValue(undefined);
});

describe('addReceipt file cleanup', () => {
  it('keeps the stored file when the DB write succeeds', async () => {
    mocks.prisma.$transaction.mockResolvedValue(undefined);
    await expect(addReceipt(user as never, 'c1', file, null)).resolves.toEqual({ id: 'c1' });
    expect(mocks.storage.save).toHaveBeenCalledTimes(1);
    expect(mocks.storage.delete).not.toHaveBeenCalled();
  });

  it('deletes the stored file and rethrows when the DB write fails', async () => {
    mocks.prisma.$transaction.mockRejectedValue(new Error('db down'));
    await expect(addReceipt(user as never, 'c1', file, null)).rejects.toThrow('db down');
    expect(mocks.storage.delete).toHaveBeenCalledWith('stored-file.png');
  });

  it('still reports the original error, and logs the orphan, if the cleanup also fails', async () => {
    mocks.prisma.$transaction.mockRejectedValue(new Error('db down'));
    mocks.storage.delete.mockRejectedValue(new Error('storage down'));
    await expect(addReceipt(user as never, 'c1', file, null)).rejects.toThrow('db down');
    expect(mocks.logger.error).toHaveBeenCalledWith('Orphaned receipt file stored-file.png - storage down');
  });

  it('stores nothing when validation fails before the save', async () => {
    await expect(addReceipt(user as never, 'c1', { ...file, mimetype: 'text/plain' }, null)).rejects.toThrow(/Only JPEG/);
    expect(mocks.storage.save).not.toHaveBeenCalled();
  });
});
