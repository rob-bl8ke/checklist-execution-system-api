# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Native module compilation deps (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Run migrations then start the API
CMD ["sh", "-c", "node dist/migrate.js && node dist/main"]
