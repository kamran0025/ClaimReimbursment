import path from 'path';
import { env } from '../../lib/env';
import { CloudinaryStorage } from './cloudinaryStorage';
import { LocalDiskStorage } from './localDiskStorage';
import type { Storage } from './storage';

// Cloudinary when its credentials are configured (any deployment without a
// persistent disk, e.g. Render's free plan), local disk otherwise (dev/tests).
export const storage: Storage = env.cloudinary
  ? new CloudinaryStorage(env.cloudinary)
  : new LocalDiskStorage(path.resolve(process.cwd(), env.uploadDir));
export type { Storage, StoredFile } from './storage';
