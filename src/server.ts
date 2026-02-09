import "dotenv/config";
import { createApp } from "@/app";
import { prisma } from "@/db";

const app = createApp();
const port = Number(process.env.PORT || 4000);

const server = app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
