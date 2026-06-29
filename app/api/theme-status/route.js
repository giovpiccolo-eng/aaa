import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const statuses = await prisma.themeStatus.findMany();
  const map = {};
  for (const s of statuses) map[s.themeKey] = { status: s.status, pacing: s.pacing };
  return Response.json(map);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { themeKey, status, pacing } = await req.json();
  if (!themeKey) return Response.json({ error: "themeKey required" }, { status: 400 });

  // Teachers can only update their own assigned themes
  if (session.user.role !== "COORDINATOR") {
    const [yearStr, stream] = parseThemeKey(themeKey);
    const assignment = await prisma.assignment.findUnique({
      where: { yearGroup_stream: { yearGroup: parseInt(yearStr), stream } },
    });
    if (!assignment || assignment.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const record = await prisma.themeStatus.upsert({
    where: { themeKey },
    update: { status, pacing, updatedBy: session.user.id },
    create: { themeKey, status: status ?? "not-started", pacing: pacing ?? "on-track", updatedBy: session.user.id },
  });
  return Response.json(record);
}

function parseThemeKey(key) {
  // key format: "y7-nov-british" → year=7, stream="british"
  const parts = key.split("-");
  const year = parts[0].replace("y", "");
  const stream = parts[parts.length - 1];
  return [year, stream];
}
