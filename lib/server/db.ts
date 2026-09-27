import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import ws from "ws";

import { PrismaClient } from "@/lib/generated/prisma/client";

// Neon's driver talks to the database over WebSockets. Node 22 has a built-in
// WebSocket, but older runtimes need the `ws` package.
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

export type Db = PrismaClient;

// Neon (production) uses its serverless driver; any other Postgres (local
// development, tests) uses the regular pg driver.
export function createDb(url = process.env.DATABASE_URL): Db {
  if (!url) throw new Error("DATABASE_URL is not set. See README.md.");
  const isNeon = new URL(url).hostname.endsWith(".neon.tech");
  const adapter = isNeon ? new PrismaNeon({ connectionString: url }) : new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

const cache = globalThis as unknown as { prisma?: Db };

// Created on first use, so building the app doesn't need a database.
export function getDb(): Db {
  cache.prisma ??= createDb();
  return cache.prisma;
}
