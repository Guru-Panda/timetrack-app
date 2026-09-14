import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Replace with your Supabase Transaction pooler URL in .env.local
    url: process.env["DATABASE_URL"] ?? "",
  },
});
