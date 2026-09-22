import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 86400),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxReceiptSizeBytes: Number(process.env.MAX_RECEIPT_SIZE_BYTES ?? 5 * 1024 * 1024),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};
