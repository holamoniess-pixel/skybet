import { z } from "zod";
import * as db from "../db";
import { hashAdminPassword, normalizeAdminEmail } from "../adminLogin";
import { adminProcedure, router } from "../_core/trpc";

const newAdminSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});

export const adminManagementRouter = router({
  customerSummary: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => db.getAdminCustomerAccountSummary(input.userId)),
  permissions: adminProcedure.query(() => ({ isOwner: true })),
  listAdministrators: adminProcedure.query(() => db.listLocalAdminAccounts()),
  createAdministrator: adminProcedure.input(newAdminSchema).mutation(async ({ ctx, input }) => {
    return db.createSubordinateLocalAdmin({
      name: input.name,
      email: normalizeAdminEmail(input.email),
      passwordHash: await hashAdminPassword(input.password),
      actorUserId: ctx.user!.id,
    });
  }),
  setAdministratorAccess: adminProcedure
    .input(z.object({ targetUserId: z.number().int().positive(), status: z.enum(["active", "revoked"]) }))
    .mutation(({ ctx, input }) => db.setSubordinateLocalAdminAccess({ ...input, actorUserId: ctx.user!.id })),
});
