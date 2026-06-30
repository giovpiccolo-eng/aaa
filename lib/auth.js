import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

const ALLOWED_DOMAIN = "acorninternationalschool.eu";
const COORDINATOR_EMAIL = "stephen.gale@acorninternationalschool.eu";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const email = user.email ?? "";
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return false;
      try {
        const role = email === COORDINATOR_EMAIL ? "COORDINATOR" : "TEACHER";
        await prisma.user.upsert({
          where: { email },
          update: { name: user.name ?? undefined, image: user.image ?? undefined },
          create: {
            id: user.id ?? crypto.randomUUID(),
            email,
            name: user.name,
            image: user.image,
            role,
          },
        });
      } catch (e) {
        console.error("DB error on sign in (non-fatal):", e.message);
        // Let them in even if DB is unreachable — role will default to TEACHER
      }
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true, role: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        } catch {
          // db unavailable — role defaults to TEACHER
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? "TEACHER";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
