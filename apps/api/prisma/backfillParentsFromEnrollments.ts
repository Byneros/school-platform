import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function digitsOnly(value: unknown) {
  return String(value || "").replace(/\D+/g, "");
}

function slugify(value: unknown) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function parentKeyFromEnrollment(enr: any) {
  const doc = digitsOnly(enr.guardianDocNumber);
  if (doc) return `DOC:${doc}`;

  const name = normalizeText(enr.guardianFullName);
  const phone = digitsOnly(enr.contactPhone);
  if (name && phone) return `NAME_PHONE:${name}:${phone}`;

  const email = normalizeText(enr.contactEmail);
  if (email) return `EMAIL:${email}`;

  return `ENR:${enr.id}`;
}

async function uniqueParentEmail(baseEmail: string) {
  const normalizedBase = String(baseEmail || "").trim().toLowerCase();
  if (!normalizedBase) throw new Error("Email base invalido");

  const [localPartRaw, domainRaw] = normalizedBase.split("@");
  const localPart = localPartRaw || "padre";
  const domain = domainRaw || "colegio.edu";

  let candidate = `${localPart}@${domain}`;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.user.findUnique({
      where: { email: candidate },
      select: { id: true, role: true }
    });
    if (!existing) return candidate;
    if (existing.role === "PARENT") return candidate;
    candidate = `${localPart}.pf${i}@${domain}`;
    i += 1;
  }
}

async function main() {
  const defaultPassword = process.env.DEFAULT_PARENT_PASSWORD || "Parent123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const enrollments = await prisma.enrollment.findMany({
    include: {
      student: { select: { id: true, fullName: true } }
    },
    orderBy: [{ year: "desc" }, { studentFullName: "asc" }]
  });

  let createdUsers = 0;
  let reusedUsers = 0;
  const parentIdsTouched = new Set<string>();
  let createdGuardians = 0;

  const parentUserIdByKey = new Map<string, string>();

  for (const enr of enrollments) {
    const key = parentKeyFromEnrollment(enr);
    let userId = parentUserIdByKey.get(key);

    if (!userId) {
      const doc = digitsOnly(enr.guardianDocNumber);
      const contactEmail = String(enr.contactEmail || "").trim().toLowerCase();
      const preferredEmail = isEmailLike(contactEmail)
        ? contactEmail
        : doc
        ? `padre.${doc}@colegio.edu`
        : `${slugify(enr.guardianFullName || "acudiente") || "acudiente"}.${digitsOnly(enr.contactPhone) || "0000"}@colegio.edu`;

      const email = await uniqueParentEmail(preferredEmail);
      const fullName = String(enr.guardianFullName || "Acudiente").trim() || "Acudiente";

      let user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true }
      });

      if (user && user.role === "PARENT") {
        userId = user.id;
        reusedUsers += 1;
      } else if (!user) {
        const created = await prisma.user.create({
          data: {
            email,
            passwordHash,
            fullName,
            role: "PARENT",
            isActive: true
          },
          select: { id: true }
        });
        userId = created.id;
        createdUsers += 1;
      } else {
        // Email ocupado por otro rol; crear variante segura.
        const fallbackEmail = await uniqueParentEmail(
          `${slugify(fullName) || "acudiente"}.${doc || digitsOnly(enr.contactPhone) || "pf"}@colegio.edu`
        );
        const created = await prisma.user.create({
          data: {
            email: fallbackEmail,
            passwordHash,
            fullName,
            role: "PARENT",
            isActive: true
          },
          select: { id: true }
        });
        userId = created.id;
        createdUsers += 1;
      }

      parentUserIdByKey.set(key, userId!);
    }

    if (!userId) continue;

    const parent = await prisma.parent.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true }
    });
    parentIdsTouched.add(parent.id);

    const relation = String(enr.guardianRelation || "").trim() || "Acudiente";
    await prisma.guardian.upsert({
      where: {
        parentId_studentId: {
          parentId: parent.id,
          studentId: enr.studentId
        }
      },
      update: { relation },
      create: {
        parentId: parent.id,
        studentId: enr.studentId,
        relation
      }
    });
    createdGuardians += 1;
  }

  console.log(`Matriculas procesadas: ${enrollments.length}`);
  console.log(`Usuarios PARENT creados: ${createdUsers}`);
  console.log(`Usuarios PARENT reutilizados: ${reusedUsers}`);
  console.log(`Padres unicos vinculados: ${parentIdsTouched.size}`);
  console.log(`Vinculos Guardian upsert ejecutados: ${createdGuardians}`);
  console.log(`Contrasena por defecto usada: ${defaultPassword}`);
}

main()
  .catch((error) => {
    console.error("Error en backfill de padres desde matricula:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
