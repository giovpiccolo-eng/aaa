import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const syncKey = searchParams.get("syncKey");
    const notes = await prisma.note.findMany({
      where: syncKey ? { syncKey } : {},
      include: { author: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(notes);
  } catch (e) {
    console.error("notes GET:", e.message);
    return Response.json([]);
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { syncKey, content } = await req.json();
    if (!syncKey || !content?.trim()) return Response.json({ error: "syncKey and content required" }, { status: 400 });
    const note = await prisma.note.create({
      data: { syncKey, content: content.trim(), authorId: session.user.id },
      include: { author: { select: { name: true, email: true, image: true } } },
    });
    return Response.json(note);
  } catch (e) {
    console.error("notes POST:", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
