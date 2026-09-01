const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const password = process.env.RESET_PASSWORD

  if (!password || password.length < 12) {
    throw new Error('RESET_PASSWORD must contain at least 12 characters')
  }

  const accounts = await prisma.platformAdmin.findMany({
    select: { id: true, email: true },
    orderBy: { id: 'asc' },
  })

  if (accounts.length === 0) {
    throw new Error('No platform owner account exists in this database')
  }

  const requestedEmail = process.env.RESET_EMAIL
  const account = requestedEmail
    ? accounts.find((candidate) => candidate.email.toLowerCase() === requestedEmail.toLowerCase())
    : accounts.length === 1
      ? accounts[0]
      : null

  if (!account) {
    const emails = accounts.map((candidate) => candidate.email).join(', ')
    throw new Error(`Multiple platform owner accounts exist. Set RESET_EMAIL to one of: ${emails}`)
  }

  await prisma.platformAdmin.update({
    where: { id: account.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  })

  console.log(`Password updated successfully for ${account.email}`)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
