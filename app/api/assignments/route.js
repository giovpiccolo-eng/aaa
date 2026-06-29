import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.assignment.findMany({
    include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } },
  });
  return Response.json(assignments);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "COORDINATOR") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { yearGroup, stream, userId } = await req.json();
  if (!yearGroup || !stream || !userId) {
    return Response.json({ error: "yearGroup, stream, userId required" }, { status: 400 });
  }

  const assignment = await prisma.assignment.upsert({
    where: { yearGroup_stream: { yearGroup: parseInt(yearGroup), stream } },
    update: { userId },
    create: { yearGroup: parseInt(yearGroup), stream, userId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
  return Response.json(assignment);
}
