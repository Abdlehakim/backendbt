import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // IMPORTANT: when using multi-file schema, point to the FOLDER (not a single file)
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
