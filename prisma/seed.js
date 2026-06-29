const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const COORDINATOR_EMAIL = "stephen.gale@acorninternationalschool.eu";

async function main() {
  // Ensure coordinator role is set for Stephen
  await prisma.user.upsert({
    where: { email: COORDINATOR_EMAIL },
    update: { role: "COORDINATOR" },
    create: {
      email: COORDINATOR_EMAIL,
      name: "Stephen Gale",
      role: "COORDINATOR",
    },
  });

  // Default assignments (can be changed via UI)
  const assignments = [
    { yearGroup: 7, stream: "british", userEmail: "eleanor.whitfield@acorninternationalschool.eu" },
    { yearGroup: 7, stream: "italian", userEmail: "chiara.lombardi@acorninternationalschool.eu" },
    { yearGroup: 8, stream: "british", userEmail: "eleanor.whitfield@acorninternationalschool.eu" },
    { yearGroup: 8, stream: "italian", userEmail: "marco.ferraro@acorninternationalschool.eu" },
    { yearGroup: 9, stream: "british", userEmail: "james.okoro@acorninternationalschool.eu" },
    { yearGroup: 9, stream: "italian", userEmail: "chiara.lombardi@acorninternationalschool.eu" },
  ];

  for (const a of assignments) {
    let user = await prisma.user.findUnique({ where: { email: a.userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: a.userEmail, name: a.userEmail.split("@")[0].replace(".", " "), role: "TEACHER" },
      });
    }
    await prisma.assignment.upsert({
      where: { yearGroup_stream: { yearGroup: a.yearGroup, stream: a.stream } },
      update: { userId: user.id },
      create: { yearGroup: a.yearGroup, stream: a.stream, userId: user.id },
    });
  }

  console.log("Seed complete. Coordinator:", COORDINATOR_EMAIL);
}

main().catch(console.error).finally(() => prisma.$disconnect());
