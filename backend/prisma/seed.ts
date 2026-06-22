import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const applicant = await prisma.user.upsert({
    where: { email: "applicant@example.com" },
    update: {},
    create: {
      email: "applicant@example.com",
      name: "Alice Applicant",
      passwordHash,
      role: "APPLICANT",
    },
  });

  const applicant2 = await prisma.user.upsert({
    where: { email: "applicant2@example.com" },
    update: {},
    create: {
      email: "applicant2@example.com",
      name: "Bob Applicant",
      passwordHash,
      role: "APPLICANT",
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@example.com" },
    update: {},
    create: {
      email: "reviewer@example.com",
      name: "Carol Reviewer",
      passwordHash,
      role: "REVIEWER",
    },
  });

  console.log("Seeded users:", { applicant, applicant2, reviewer });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
