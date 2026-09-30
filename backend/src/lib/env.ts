import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Comma-separated in the env var (e.g. "http://localhost:5173,https://app.example.com")
// so the backend can serve more than one known frontend at once — a local
// dev frontend and a deployed one, or two deployed environments — without
// opening CORS to arbitrary origins (see app.ts's cors() setup).
function parseCorsOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length === 0) throw new Error('CORS_ORIGIN must not resolve to an empty origin list');
  return origins;
}

// All three Cloudinary credentials together, or none (→ local-disk storage).
// A partial set is a misconfiguration, so fail at boot rather than silently
// falling back to a disk that may not persist.
function parseCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName && !apiKey && !apiSecret) return null;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be set (or none)');
  }
  return { cloudName, apiKey, apiSecret, folder: process.env.CLOUDINARY_FOLDER ?? 'receipts' };
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 86400),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  cloudinary: parseCloudinary(),
  maxReceiptSizeBytes: Number(process.env.MAX_RECEIPT_SIZE_BYTES ?? 5 * 1024 * 1024),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};
