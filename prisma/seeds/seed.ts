import { PrismaClient } from '../../src/lib/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'dev.wikipedia@gmail.com' },
    update: {},
    create: {
      email: 'dev.wikipedia@gmail.com',
      name: 'Admin',
      password: 'admin123456',
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log('✅ Admin user created:', admin.email)
}

main().catch(console.error).finally(() => prisma.$disconnect())