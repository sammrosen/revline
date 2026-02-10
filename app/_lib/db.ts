import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Always cache globally — prevents multiple PrismaClient instances.
// Next.js standalone output can re-evaluate route modules in some
// chunking scenarios, creating duplicate clients with separate
// connection pools (memory leak + connection exhaustion).
globalForPrisma.prisma = prisma;





