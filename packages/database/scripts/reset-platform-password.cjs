const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const password = process.env.RESET_PASSWORD

  if (!password || password.length < 12) {
    throw new Error('RESET_PASSWORD must contain at least 12 characters')
  }

  const account = await prisma.platformAdmin.findUnique({
    where: { email: 'owner@shift-saas.com' },
    select: { id: true },
  })

  if (!account) {
    throw new Error('Platform owner account was not found')
  }

  await prisma.platformAdmin.update({
    where: { id: account.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  })

  console.log('Password updated successfully')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
