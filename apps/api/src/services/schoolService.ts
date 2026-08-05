import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";
import { conflict } from "../utils/httpErrors.js";
const PASSWORD_ROUNDS = 10;

async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export interface CreateSchoolInput {
  school: {
    code: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    nit?: string;
  };

  admin: {
    fullName: string;
    email: string;
    password: string;
  };
}

export async function listSchools() {
  return prisma.school.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

export async function getSchool(id: string) {
  return prisma.school.findUnique({
    where: { id },
  });
}

export async function createSchool(data: CreateSchoolInput) {
  const { school, admin } = data;

  const passwordHash = await hashPassword(admin.password);

  if (!passwordHash) {
    throw new Error("No fue posible generar el hash de la contraseña.");
  }
  return prisma.$transaction(async (tx) => {
    const existingSchool = await tx.school.findUnique({
      where: {
        code: school.code,
      },
    });

    if (existingSchool) {
      throw conflict("Ya existe un colegio con ese código.");
    }

    const existingAdmin = await tx.user.findUnique({
      where: {
        email: admin.email,
      },
    });

    if (existingAdmin) {
      throw conflict("Ya existe un usuario con ese correo electrónico.");
    }

    const createdSchool = await tx.school.create({
      data: school,
    });

    const createdAdmin = await tx.user.create({
      data: {
        email: admin.email,
        passwordHash,
        fullName: admin.fullName,
        role: "ADMIN",
        schoolId: createdSchool.id,
      },
    });

    return {
      school: createdSchool,
      admin: {
        id: createdAdmin.id,
        fullName: createdAdmin.fullName,
        email: createdAdmin.email,
        role: createdAdmin.role,
        schoolId: createdAdmin.schoolId,
      },
    };
  });
}

export interface UpdateSchoolInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  nit?: string;
  isActive?: boolean;
}

export async function updateSchool(id: string, data: UpdateSchoolInput) {
  const school = await prisma.school.findUnique({
    where: { id },
  });

  if (!school) {
    const error = new Error("School not found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  return prisma.school.update({
    where: { id },
    data,
  });
}
