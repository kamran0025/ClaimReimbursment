import path from 'path';
import { env } from '../../lib/env';
import { LocalDiskStorage } from './localDiskStorage';
import type { Storage } from './storage';

export const storage: Storage = new LocalDiskStorage(path.resolve(process.cwd(), env.uploadDir));
export type { Storage, StoredFile } from './storage';
