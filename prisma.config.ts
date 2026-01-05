// Load environment variables from .env.local first, then .env
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // Use a dummy URL for generate operations (doesn't need real DB)
    // For actual DB operations, DATABASE_URL must be set
    url: env("DATABASE_URL") || "postgresql://dummy:dummy@localhost:5432/dummy",
  },
});
