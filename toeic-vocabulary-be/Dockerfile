FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma7.config.ts ./

FROM base AS development
ENV NODE_ENV=development
RUN npm install && npx prisma generate
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]

FROM base AS build
RUN npm install
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN npm install --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads/audio
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
