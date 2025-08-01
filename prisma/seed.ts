import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create a default AuthUser (example)
  await prisma.authUser.upsert({
    where: { email: 'admin@neurofocus.com' },
    update: {},
    create: {
      email: 'admin@neurofocus.com',
      password: 'adminpassword', // In production, hash this!
      name: 'Admin',
      role: 'admin',
    },
  })

  // Create a default Participant (example)
  await prisma.participant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Participant',
      authUserId: null,
      consentGiven: true,
      consentAt: new Date(),
    },
  })

  // Create a default Session (example)
  await prisma.session.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      participantId: '00000000-0000-0000-0000-000000000001',
      startedAt: new Date(),
      notes: 'Initial session for testing',
    },
  })

  // Create default EegStageData for all 4 stages (examples)
  await prisma.eegStageData.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      sessionId: '00000000-0000-0000-0000-000000000001',
      stageName: '1_Baseline_Relaxed',
      stageOrder: 1,
      durationSeconds: 180, // 3 minutes
      instructions: 'Close your eyes, relax, and listen to calming music or nature sounds.',
      eegData: {},
    },
  })

  await prisma.eegStageData.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      sessionId: '00000000-0000-0000-0000-000000000001',
      stageName: '2_Cognitive_Warmup',
      stageOrder: 2,
      durationSeconds: 120, // 2 minutes
      instructions: 'Do simple tasks like basic arithmetic or identify colors. Nothing too hard.',
      eegData: {},
    },
  })

  await prisma.eegStageData.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      sessionId: '00000000-0000-0000-0000-000000000001',
      stageName: '3_Focused_Task',
      stageOrder: 3,
      durationSeconds: 360, // 6 minutes
      instructions: 'Perform a focused task (e.g., mental math, reading, or debugging). Stay concentrated.',
      eegData: {},
    },
  })

  await prisma.eegStageData.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      sessionId: '00000000-0000-0000-0000-000000000001',
      stageName: '4_Post_Task_Rest',
      stageOrder: 4,
      durationSeconds: 180, // 3 minutes
      instructions: 'Return to a relaxed state. Breathe deeply, eyes closed, no task.',
      eegData: {},
    },
  })

  // Create a default EegData (example)
  await prisma.eegData.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      userId: '00000000-0000-0000-0000-000000000001',
      eegData: {},
      betaPower: 0.5,
      lowBetaWarning: false,
    },
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 