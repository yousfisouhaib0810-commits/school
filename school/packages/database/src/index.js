import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
export default prisma;
export { PrismaClient } from "@prisma/client";
//# sourceMappingURL=index.js.map