import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { ApiError, ErrorCode } from './errors';

export interface AuthTokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  const payload: AuthTokenPayload = { sub: userId };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresInSeconds });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.bcryptSaltRounds);
}

export async function login(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new ApiError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password.');

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new ApiError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password.');

  if (!user.isActive) throw new ApiError(ErrorCode.FORBIDDEN_ROLE, 'This account has been deactivated.');

  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}
