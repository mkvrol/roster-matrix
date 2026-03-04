import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";

export const settingsRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user?.email) return null;

    const user = await prisma.user.findUnique({
      where: { email: ctx.session.user.email },
      select: {
        name: true,
        email: true,
        role: true,
        teamAffiliationId: true,
        image: true,
        teamAffiliation: {
          select: { name: true, abbreviation: true },
        },
      },
    });

    return user;
  }),

  updateTeamAffiliation: protectedProcedure
    .input(z.object({ teamId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user?.email) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });
      }

      const user = await prisma.user.upsert({
        where: { email: ctx.session.user.email },
        update: { teamAffiliationId: input.teamId },
        create: {
          email: ctx.session.user.email,
          name: ctx.session.user.name ?? "User",
          teamAffiliationId: input.teamId,
        },
        select: {
          name: true,
          email: true,
          role: true,
          teamAffiliationId: true,
          image: true,
          teamAffiliation: {
            select: { name: true, abbreviation: true },
          },
        },
      });

      return user;
    }),

  getTeams: protectedProcedure.query(async () => {
    return prisma.team.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        logoUrl: true,
        primaryColor: true,
      },
    });
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user?.email) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });
      }

      const user = await prisma.user.upsert({
        where: { email: ctx.session.user.email },
        update: { name: input.name },
        create: {
          email: ctx.session.user.email,
          name: input.name ?? "User",
        },
        select: {
          name: true,
          email: true,
          role: true,
          teamAffiliationId: true,
          image: true,
          teamAffiliation: {
            select: { name: true, abbreviation: true },
          },
        },
      });

      return user;
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user?.email) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" });
      }

      const user = await prisma.user.findUnique({
        where: { email: ctx.session.user.email },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User account not found. Please sign out and sign in again." });
      }

      if (!user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password login not configured for this account" });
      }

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);

      await prisma.user.update({
        where: { email: ctx.session.user.email },
        data: { passwordHash },
      });

      return { success: true };
    }),
});
