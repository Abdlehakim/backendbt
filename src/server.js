"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("@/app");
const db_1 = require("@/db");
const app = (0, app_1.createApp)();
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
});
async function shutdown() {
    server.close(async () => {
        await db_1.prisma.$disconnect();
        process.exit(0);
    });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
