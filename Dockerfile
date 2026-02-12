FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

COPY package*.json ./
RUN npm ci

COPY . .

# Provide DATABASE_URL at build time so prisma can load prisma.config.ts
# (Should be MySQL, since your compose runs mysql:8.4)
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# ✅ IMPORTANT: generate using the schema folder (multi-file schema)
RUN ./node_modules/.bin/prisma generate --schema prisma/schema

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]
