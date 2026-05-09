import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const prisma = new PrismaClient();

type Args = {
  email: string;
  password: string;
  activate: boolean;
};

function parseArgs(argv: string[]): Args {
  let email = "";
  let password = "";
  let activate = false;
  const positional: string[] = [];

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    if (arg.startsWith("--email=")) {
      email = String(arg.slice("--email=".length) || "").trim().toLowerCase();
      continue;
    }
    if (arg.startsWith("--password=")) {
      password = String(arg.slice("--password=".length) || "");
      continue;
    }
    if (arg === "--email") {
      email = String(argv[++i] || "").trim().toLowerCase();
      continue;
    }
    if (arg === "--password") {
      password = String(argv[++i] || "");
      continue;
    }
    if (arg === "--activate") {
      activate = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Argumento no reconocido: ${arg}`);
  }

  if (!email && positional.length >= 1) {
    email = String(positional[0] || "").trim().toLowerCase();
  }
  if (!password && positional.length >= 2) {
    password = String(positional[1] || "");
  }

  if (!email) throw new Error("Debes indicar --email.");
  if (!password) {
    password = String(process.env.RESET_USER_PASSWORD || "");
  }
  if (!password || password.length < 6) {
    throw new Error("Debes indicar --password o RESET_USER_PASSWORD con minimo 6 caracteres.");
  }

  return { email, password, activate };
}

function printUsage() {
  console.log(
    [
      "Uso:",
      "  npm --workspace apps/api run prisma:reset:user -- --email usuario@colegio.edu --password NuevaClave123!",
      "  RESET_USER_PASSWORD=NuevaClave123! npm --workspace apps/api run prisma:reset:user -- --email usuario@colegio.edu --activate",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv);

  const user = await prisma.user.findFirst({
    where: { email: { equals: args.email, mode: "insensitive" } },
    select: { id: true, email: true, role: true, isActive: true, fullName: true },
  });

  if (!user) {
    throw new Error(`Usuario no encontrado: ${args.email}`);
  }

  const passwordHash = await bcrypt.hash(args.password, 10);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      ...(args.activate ? { isActive: true } : {}),
    },
    select: { email: true, role: true, isActive: true, fullName: true },
  });

  console.log("Usuario actualizado:");
  console.log(`- Email: ${updated.email}`);
  console.log(`- Nombre: ${updated.fullName}`);
  console.log(`- Rol: ${updated.role}`);
  console.log(`- Activo: ${updated.isActive}`);
}

main()
  .catch((error) => {
    console.error("Error reseteando usuario:", error?.message || error);
    printUsage();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
