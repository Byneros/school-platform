import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const envFromCwd = path.resolve(process.cwd(), ".env");
const envFromApp = path.resolve(dirname, "..", "..", ".env");

dotenv.config({ path: envFromCwd });
dotenv.config({ path: envFromApp });

const DEFAULT_PASSWORD = process.env.PARENT_DEFAULT_PASSWORD || "Temporal123!";
const prisma = new PrismaClient();

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value) => String(value || "").trim();

async function main() {
  const parentUsers = await prisma.user.findMany({
    where: { role: "PARENT" },
    select: { email: true }
  });
  const existingEmails = new Set(parentUsers.map((p) => normalizeEmail(p.email)).filter(Boolean));

  const [enrollments, admissions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { status: { not: "INACTIVE" }, contactEmail: { not: null } },
      select: {
        studentId: true,
        contactEmail: true,
        guardianFullName: true,
        guardianRelation: true
      }
    }),
    prisma.admission.findMany({
      where: { status: { not: "REJECTED" }, contactEmail: { not: null } },
      select: {
        id: true,
        contactEmail: true,
        guardianFullName: true,
        guardianRelation: true
      }
    })
  ]);

  const pending = new Map();

  const upsertBucket = (emailRaw, fullNameRaw, relationRaw, studentId) => {
    const email = normalizeEmail(emailRaw);
    if (!email || existingEmails.has(email)) return;
    const fullName = normalizeText(fullNameRaw) || "Acudiente sin nombre";
    const relation = normalizeText(relationRaw) || "Acudiente";

    const current = pending.get(email) || {
      email,
      fullName,
      relation,
      studentIds: new Set()
    };
    if (!current.fullName && fullName) current.fullName = fullName;
    if (!current.relation && relation) current.relation = relation;
    if (studentId) current.studentIds.add(studentId);
    pending.set(email, current);
  };

  enrollments.forEach((e) => {
    upsertBucket(e.contactEmail, e.guardianFullName, e.guardianRelation, e.studentId);
  });
  admissions.forEach((a) => {
    upsertBucket(a.contactEmail, a.guardianFullName, a.guardianRelation, undefined);
  });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let createdUsers = 0;
  let createdGuardians = 0;

  for (const entry of pending.values()) {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: entry.email,
          passwordHash,
          fullName: entry.fullName,
          role: "PARENT",
          isActive: true
        }
      });
      const parent = await tx.parent.create({
        data: { userId: user.id }
      });

      const guardianRows = Array.from(entry.studentIds).map((studentId) => ({
        parentId: parent.id,
        studentId,
        relation: entry.relation || "Acudiente"
      }));
      if (guardianRows.length > 0) {
        const result = await tx.guardian.createMany({ data: guardianRows, skipDuplicates: true });
        createdGuardians += result.count;
      }
      return user;
    });

    createdUsers += 1;
    console.log(`Creado usuario acudiente: ${created.email} (${created.fullName})`);
  }

  console.log(`\nResumen: ${createdUsers} usuarios creados, ${createdGuardians} relaciones guardian creadas.`);
  if (createdUsers > 0) {
    console.log(`Contrasena temporal usada: ${DEFAULT_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error("Error creando acudientes:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
