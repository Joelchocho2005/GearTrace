import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function main() {
  console.log('🌱 Iniciando seedeo de la base de datos...');

  // 1. Limpiar datos existentes (opcional, cuidado en producción)
  // await prisma.searchLog.deleteMany();
  // await prisma.part.deleteMany();
  // await prisma.box.deleteMany();
  // await prisma.user.deleteMany();

  // 2. Crear Usuarios con sus roles (password: password123)
  const defaultPassword = await bcrypt.hash('password123', BCRYPT_ROUNDS);

  console.log('👤 Creando usuarios...');
  
  const gerente = await prisma.user.upsert({
    where: { email: 'gerente@geartrace.com' },
    update: { password: defaultPassword },
    create: {
      name: 'Gerente Principal',
      email: 'gerente@geartrace.com',
      password: defaultPassword,
      role: Role.GERENTE,
    },
  });

  const mecanico = await prisma.user.upsert({
    where: { email: 'mecanico@geartrace.com' },
    update: { password: defaultPassword },
    create: {
      name: 'Mecánico Jefe',
      email: 'mecanico@geartrace.com',
      password: defaultPassword,
      role: Role.MECANICO,
    },
  });

  const cliente = await prisma.user.upsert({
    where: { email: 'cliente@geartrace.com' },
    update: { password: defaultPassword },
    create: {
      name: 'Cliente Demo',
      email: 'cliente@geartrace.com',
      password: defaultPassword,
      role: Role.CLIENTE,
    },
  });

  console.log(`✅ Usuarios creados: ${gerente.email}, ${mecanico.email}, ${cliente.email}`);

  // 3. Crear Cajas (solo si no existen)
  console.log('📦 Creando cajas físicas...');
  
  const cajasData = [
    { name: 'Caja A - Filtros', ledIndex: 0, location: 'Estante 1, Nivel A', colorHex: '#FF4500' },
    { name: 'Caja B - Frenos', ledIndex: 1, location: 'Estante 1, Nivel B', colorHex: '#1E90FF' },
    { name: 'Caja C - Correas', ledIndex: 2, location: 'Estante 2, Nivel A', colorHex: '#32CD32' },
    { name: 'Caja D - Eléctrico', ledIndex: 3, location: 'Estante 2, Nivel B', colorHex: '#FFD700' },
    { name: 'Caja E - Lubricantes', ledIndex: 4, location: 'Estante 3, Nivel A', colorHex: '#9400D3' },
  ];

  for (const c of cajasData) {
    await prisma.box.upsert({
      where: { ledIndex: c.ledIndex },
      update: {},
      create: c,
    });
  }

  // 4. Crear Piezas
  console.log('⚙️ Creando inventario de piezas...');
  
  // Buscar caja 1 y 2 para relacionar
  const cajaA = await prisma.box.findUnique({ where: { ledIndex: 0 } });
  const cajaB = await prisma.box.findUnique({ where: { ledIndex: 1 } });

  if (cajaA && cajaB) {
    await prisma.part.upsert({
      where: { code: 'FLT-OIL-001' },
      update: {},
      create: {
        name: 'Filtro de aceite Toyota',
        code: 'FLT-OIL-001',
        quantity: 15,
        minStock: 3,
        boxId: cajaA.id,
        keywords: ['filtro aceite', 'filtro toyota', 'filtro'],
      },
    });

    await prisma.part.upsert({
      where: { code: 'BRK-PAD-001' },
      update: {},
      create: {
        name: 'Pastillas de freno Brembo',
        code: 'BRK-PAD-001',
        quantity: 6,
        minStock: 2,
        boxId: cajaB.id,
        keywords: ['pastillas', 'frenos', 'pastillas freno'],
      },
    });
  }

  console.log('🎉 ¡Seed finalizado exitosamente!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
