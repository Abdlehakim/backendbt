FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

COPY package*.json ./
RUN npm ci

COPY . .

# ✅ Provide DATABASE_URL at build time so prisma can load config
ARG DATABASE_URL="postgresql://projectbt:projectbt@db:5432/projectbt?schema=public"
ENV DATABASE_URL=$DATABASE_URL

RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
