import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const worker = await prisma.user.create({ data: { name: '현장직A', role: 'worker' } });
  const manager = await prisma.user.create({ data: { name: '관리자B', role: 'manager' } });

  // checklist templates
  await prisma.checklistTemplateItem.createMany({ data: [
    { category: 'safety', title: '보호장비 착용' },
    { category: 'safety', title: '비상정지 버튼 확인' },
    { category: 'quality', title: '초품 검사' },
    { category: 'quality', title: '치수 공차 확인' },
  ]});

  console.log('Seeded users:', worker.id, manager.id);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });