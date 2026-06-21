import prisma from './prisma';

// Nome della categoria di sistema usata per TUTTI gli addebiti di saldo carta (CC).
// Avere una categoria nota e comune rende gli addebiti sempre tracciabili e utilizzabili
// come chiave di esclusione affidabile dalle medie/proposte di budget.
export const SETTLEMENT_CATEGORY_NAME = 'Pagamento Carta';

// Restituisce l'id della categoria di sistema "Pagamento Carta" (EXPENSE) dell'utente,
// creandola se non esiste. Idempotente: rispetta il vincolo unico [userId, name, type]
// e tollera la corsa concorrente (P2002 → rilegge). Se per qualche motivo esistesse già
// una categoria con quel nome ma non marcata di sistema, la promuove a isSystem.
export async function ensureSettlementCategory(userId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { userId, name: SETTLEMENT_CATEGORY_NAME, type: 'EXPENSE' },
    select: { id: true, isSystem: true },
  });

  if (existing) {
    if (!existing.isSystem) {
      await prisma.category.update({ where: { id: existing.id }, data: { isSystem: true } });
    }
    return existing.id;
  }

  try {
    const created = await prisma.category.create({
      data: {
        userId,
        name: SETTLEMENT_CATEGORY_NAME,
        type: 'EXPENSE',
        icon: '💳',
        color: '#78716c',
        isSystem: true,
      },
      select: { id: true },
    });
    return created.id;
  } catch (e: any) {
    // Corsa concorrente: un'altra richiesta l'ha creata nel frattempo → rileggi.
    if (e?.code === 'P2002') {
      const again = await prisma.category.findFirst({
        where: { userId, name: SETTLEMENT_CATEGORY_NAME, type: 'EXPENSE' },
        select: { id: true },
      });
      if (again) return again.id;
    }
    throw e;
  }
}
