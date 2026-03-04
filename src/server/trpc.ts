import { TRPCError, initTRPC } from "@trpc/server";
import { getServerSession } from "next-auth";
import type { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const createContext = async () => {
  const session = await getServerSession(authOptions);
  return { session };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

// Role hierarchy: ADMIN > GM > ANALYST > SCOUT > VIEWER
const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 5,
  GM: 4,
  ANALYST: 3,
  SCOUT: 2,
  VIEWER: 1,
};

function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

function createRoleProcedure(minRole: UserRole) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const user = await prisma.user.findUnique({
      where: { email: ctx.session.user.email! },
      select: { role: true },
    });
    if (!user || !hasMinRole(user.role, minRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires ${minRole} role or higher`,
      });
    }
    return next({ ctx: { ...ctx, userRole: user.role } });
  });
}

export const adminProcedure = createRoleProcedure("ADMIN");
export const gmProcedure = createRoleProcedure("GM");
export const analystProcedure = createRoleProcedure("ANALYST");
export const scoutProcedure = createRoleProcedure("SCOUT");
