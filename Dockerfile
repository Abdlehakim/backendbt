FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

COPY package*.json ./
RUN npm ci

COPY . .

# Provide a valid URL at build time so Prisma can load prisma.config.ts.
# Runtime values still come from backendbt/.env via compose env_file.
ARG DATABASE_URL="mysql://app_user:app_pass@db:3306/app_db?allowPublicKeyRetrieval=true&ssl=false"
ENV DATABASE_URL=$DATABASE_URL

# Generate using the schema folder (multi-file Prisma schema).
RUN ./node_modules/.bin/prisma generate --schema prisma/schema

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]
