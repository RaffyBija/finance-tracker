import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  // Default Prisma = 5s: le transazioni interattive con molte query sequenziali
  // (es. organizza categorie) su DB remoto (Neon) lo superano → P2028 "Transaction not found".
  transactionOptions: { maxWait: 10000, timeout: 30000 },
});

export default prisma;