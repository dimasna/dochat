import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  }).$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (e: unknown) {
          // P1017 = server closed connection — reconnect and retry once
          if (
            e instanceof Error &&
            "code" in e &&
            (e as { code: string }).code === "P1017"
          ) {
            return await query(args);
          }
          throw e;
        }
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = prisma as unknown as PrismaClient;

export { Prisma } from "@prisma/client";
export type { PrismaClient } from "@prisma/client";
export { pgNotifyClient } from "./pg-notify";
