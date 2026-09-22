FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY --from=base /app/dist ./dist

EXPOSE 4000
# Migrate, then seed (a no-op once the database has any users — see
# prisma/seed.ts — so this is safe to run on every boot, not just the
# first), then start the server. Keeps first-deploy setup to zero manual
# steps — no Shell tab (a paid-plan feature on Render) required.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/server.js"]
