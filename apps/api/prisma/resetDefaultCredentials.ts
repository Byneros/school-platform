import bcrypt from "bcryptjs";
import { PrismaClient, RoleName } from "@prisma/client";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const prisma = new PrismaClient();

type DefaultCredential = {
  role: RoleName;
  email: string;
  password: string;
  fullName: string;
};

const defaults: DefaultCredential[] = [
  {
    role: "ADMIN",
    email: "admin@colegio.edu",
    password: "Admin123!",
    fullName: "Administrador Principal",
  },
  {
    role: "TEACHER",
    email: "docente@colegio.edu",
    password: "Teacher123!",
    fullName: "Docente Demo",
  },
  {
    role: "PARENT",
    email: "padre@colegio.edu",
    password: "Parent123!",
    fullName: "Padre Demo",
  },
];

async function ensureRoleEntity(userId: string, role: RoleName) {
  if (role === "TEACHER") {
    await prisma.teacher.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        professionalProfile: "Docente asignado por reseteo de credenciales",
      },
    });
  }

  if (role === "PARENT") {
    await prisma.parent.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }
}

async function resetOne(def: DefaultCredential) {
  const passwordHash = await bcrypt.hash(def.password, 10);

  const user = await prisma.user.upsert({
    where: { email: def.email },
    update: {
      passwordHash,
      role: def.role,
      fullName: def.fullName,
      isActive: true,
    },
    create: {
      email: def.email,
      passwordHash,
      role: def.role,
      fullName: def.fullName,
      isActive: true,
    },
  });

  await ensureRoleEntity(user.id, def.role);

  return {
    role: def.role,
    email: def.email,
    fullName: user.fullName,
    isActive: user.isActive,
  };
}

async function main() {
  const results = [];
  for (const def of defaults) {
    const result = await resetOne(def);
    results.push(result);
  }

  console.log("Credenciales restauradas:");
  for (const item of results) {
    console.log(`- ${item.role}: ${item.email} (activo=${item.isActive})`);
  }
}

main()
  .catch((error) => {
    console.error("Error reseteando credenciales:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
