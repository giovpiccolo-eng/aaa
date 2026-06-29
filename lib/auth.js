import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

const ALLOWED_DOMAIN = "acorninternationalschool.eu";
const COORDINATOR_EMAIL = "stephen.gale@acorninternationalschool.eu";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email ?? "";
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        // Ensure coordinator role is always set correctly
        if (user.email === COORDINATOR_EMAIL && user.role !== "COORDINATOR") {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "COORDINATOR" },
          });
          session.user.role = "COORDINATOR";
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
