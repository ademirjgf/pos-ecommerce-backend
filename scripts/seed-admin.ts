
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Obtener y validar las variables de entorno
const connectionString = process.env.DATABASE_URL;
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

if (!connectionString || !adminEmail || !adminPassword) {
  throw new Error('Faltan variables para crear el administrador');
}

if (adminPassword.length < 12) {
  throw new Error('La contraseña debe tener al menos 12 caracteres');
}

// Guardar los valores validados con tipos string
const email: string = adminEmail;
const password: string = adminPassword;

// Conexión a Prisma
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Verificar si ya existe el administrador
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    if (existing.role !== 'ADMIN') {
      throw new Error(
        'Ese correo pertenece a otro tipo de usuario',
      );
    }

    // Actualizar credenciales del administrador existente
    const newPasswordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: newPasswordHash,
        active: true,
      },
    });

    console.log('Credenciales del administrador actualizadas');
    return;
  }

  // Crear administrador si todavía no existe
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log('Administrador creado:', admin);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
