import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema", // ✅ load all *.prisma in this folder

  migrations: {
    seed: "node prisma/seeds/seed.js", // ✅ your real seed path
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});
