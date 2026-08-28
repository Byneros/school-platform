import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";
import type { DocumentType } from "@prisma/client";
import { conflict } from "../utils/httpErrors.js";
import { getBrandingSettings } from "../utils/brandingSettings.js";
import { sendEmail } from "../utils/mailer.js";
import { enqueueEmail, type EmailJobPayload } from "./emailQueue.js";
const PASSWORD_ROUNDS = 10;

async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

function cleanOptional(value: string | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeCreateSchoolInput(data: CreateSchoolInput): CreateSchoolInput {
  return {
    school: {
      code: data.school.code.trim().toUpperCase(),
      name: data.school.name.trim(),
      email: data.school.email ? normalizeEmail(data.school.email) : undefined,
      phone: cleanOptional(data.school.phone),
      address: cleanOptional(data.school.address),
      website: cleanOptional(data.school.website),
      nit: cleanOptional(data.school.nit),
    },
    admin: {
      fullName: data.admin.fullName.trim(),
      email: normalizeEmail(data.admin.email),
      docType: data.admin.docType,
      docNumber: cleanOptional(data.admin.docNumber),
      phone: cleanOptional(data.admin.phone),
      password: data.admin.password,
    },
  };
}

async function sendAdminCredentials(input: {
  admin: { fullName: string; email: string };
  password: string;
  schoolName: string;
}) {
  const branding = await getBrandingSettings();
  const brandName = input.schoolName || branding.schoolName || "School Platform";
  const payload: EmailJobPayload = {
    to: input.admin.email,
    subject: `Credenciales de administrador - ${brandName}`,
    text: `Hola ${input.admin.fullName},\n\nEl colegio ${brandName} fue creado correctamente y tu usuario administrador quedo activo.\nCorreo: ${input.admin.email}\nContrasena: ${input.password}\n\nPor favor cambia la contrasena al ingresar.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom: 8px;">
          ${branding.logoDataUrl ? `<img src="${branding.logoDataUrl}" alt="Logo" style="height:40px; width:40px; object-fit:contain;" />` : ""}
          <div style="font-size:16px; font-weight:700; color:${branding.primaryColor};">${brandName}</div>
        </div>
        <h2 style="margin: 0 0 8px; color:${branding.primaryColor};">Credenciales de administrador</h2>
        <p>Hola <strong>${input.admin.fullName}</strong>,</p>
        <p>El colegio <strong>${brandName}</strong> fue creado correctamente y tu usuario administrador quedo activo.</p>
        <table style="margin: 12px 0; border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding: 6px 10px; background: #f1f5f9; border: 1px solid #e2e8f0;">Correo</td>
            <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${input.admin.email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; background: #f1f5f9; border: 1px solid #e2e8f0;">Contrasena</td>
            <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${input.password}</td>
          </tr>
        </table>
        <p style="color: #475569;">Por favor cambia la contrasena al ingresar.</p>
        <div style="margin-top: 12px; font-size: 12px; color: #64748b;">${branding.footerText || ""}</div>
      </div>
    `,
  };

  const queued = await enqueueEmail(payload);
  if (!queued) {
    await sendEmail(payload);
  }
  return queued ? "queued" : "sent";
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
    docType?: DocumentType;
    docNumber?: string;
    phone?: string;
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
  const { school, admin } = normalizeCreateSchoolInput(data);

  const passwordHash = await hashPassword(admin.password);

  if (!passwordHash) {
    throw new Error("No fue posible generar el hash de la contrasena.");
  }
  const result = await prisma.$transaction(async (tx) => {
    const existingSchool = await tx.school.findUnique({
      where: {
        code: school.code,
      },
    });

    if (existingSchool) {
      throw conflict("Ya existe un colegio con ese codigo.");
    }

    if (school.nit) {
      const existingNit = await tx.school.findFirst({
        where: {
          nit: school.nit,
        },
      });

      if (existingNit) {
        throw conflict("Ya existe un colegio con ese NIT.");
      }
    }

    const existingAdmin = await tx.user.findUnique({
      where: {
        email: admin.email,
      },
    });

    if (existingAdmin) {
      throw conflict("Ya existe un usuario con ese correo electronico.");
    }

    if (admin.docType && admin.docNumber) {
      const existingDocument = await tx.user.findUnique({
        where: {
          docType_docNumber: {
            docType: admin.docType,
            docNumber: admin.docNumber,
          },
        },
      });

      if (existingDocument) {
        throw conflict("Ya existe un usuario con ese documento.");
      }
    }

    const createdSchool = await tx.school.create({
      data: school,
    });

    const createdAdmin = await tx.user.create({
      data: {
        email: admin.email,
        passwordHash,
        fullName: admin.fullName,
        docType: admin.docType,
        docNumber: admin.docNumber,
        phone: admin.phone,
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
      messages: ["Colegio creado correctamente.", "Administrador creado correctamente."],
    };
  });

  let credentialsDelivery: "queued" | "sent" | "failed" = "failed";
  try {
    credentialsDelivery = await sendAdminCredentials({
      admin,
      password: admin.password,
      schoolName: result.school.name,
    });
  } catch {
    credentialsDelivery = "failed";
  }

  return {
    ...result,
    credentialsDelivery,
    messages: [
      ...result.messages,
      credentialsDelivery === "failed"
        ? "El colegio y el administrador fueron creados, pero no fue posible enviar las credenciales."
        : "Credenciales enviadas al correo del administrador.",
    ],
  };
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
