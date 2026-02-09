"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
    throw new Error("DATABASE_URL is missing");
const adapter = new adapter_mariadb_1.PrismaMariaDb(databaseUrl);
exports.prisma = new client_1.PrismaClient({ adapter });
