import path from 'path';
import crypto from 'crypto';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import type { Storage, StoredFile } from './storage';

// Every receipt (image or PDF) is uploaded as a `raw`, `private` asset: raw
// skips Cloudinary's image processing and its PDF-delivery restriction on
// free accounts, and private means there is no public CDN URL — the file is
// only fetched server-side via a short-lived signed download URL, so access
// still goes through the authenticated, scoped download endpoint.
const RESOURCE_OPTIONS = { resource_type: 'raw', type: 'private' } as const;
const DOWNLOAD_URL_TTL_SECONDS = 60;

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

export class CloudinaryStorage implements Storage {
  constructor(private readonly config: CloudinaryConfig) {
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
  }

  async save(buffer: Buffer, suggestedName: string): Promise<StoredFile> {
    const ext = path.extname(suggestedName).slice(0, 10);
    const publicId = `${this.config.folder}/${crypto.randomUUID()}${ext}`;
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ ...RESOURCE_OPTIONS, public_id: publicId, overwrite: false }, (error, response) => {
          if (error || !response) reject(error ?? new Error('Cloudinary upload returned no response'));
          else resolve(response);
        })
        .end(buffer);
    });
    return { storagePath: result.public_id };
  }

  async read(storagePath: string): Promise<Buffer> {
    const url = cloudinary.utils.private_download_url(storagePath, '', {
      ...RESOURCE_OPTIONS,
      expires_at: Math.floor(Date.now() / 1000) + DOWNLOAD_URL_TTL_SECONDS,
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cloudinary download failed (${response.status}) for ${storagePath}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(storagePath: string): Promise<void> {
    await cloudinary.uploader.destroy(storagePath, { ...RESOURCE_OPTIONS, invalidate: true });
  }
}
