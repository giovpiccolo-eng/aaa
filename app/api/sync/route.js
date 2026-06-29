import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const states = await prisma.syncState.findMany();
  const map = {};
  for (const s of states) {
    map[s.syncKey] = { aligned: s.aligned, reason: s.reason };
  }
  return Response.json(map);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Only coordinators can update sync alignment
  if (session.user.role !== "COORDINATOR") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { syncKey, aligned, reason } = await req.json();
  if (!syncKey) return Response.json({ error: "syncKey required" }, { status: 400 });

  const record = await prisma.syncState.upsert({
    where: { syncKey },
    update: { aligned, reason: reason ?? null, updatedBy: session.user.id },
    create: { syncKey, aligned: aligned ?? false, reason: reason ?? null, updatedBy: session.user.id },
  });
  return Response.json(record);
}
