import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Authenticate a cron request. Accepts either:
 * 1. Bearer token matching CRON_SECRET (Vercel cron / automated)
 * 2. Admin session cookie (manual trigger from admin page)
 */
export async function verifyCronAuth(request: NextRequest): Promise<boolean> {
  // Check CRON_SECRET header first (Vercel cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Fallback: check for admin session (manual admin triggers)
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return false;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    return user?.role === "ADMIN";
  } catch {
    return false;
  }
}
