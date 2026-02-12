import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // ✅ le plus compatible : pointer le fichier "root"
  schema: "prisma/schema/schema.prisma",

  migrations: {
    seed: "node prisma/seed.js",
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});
