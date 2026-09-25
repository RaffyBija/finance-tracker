import prisma from './prisma';

// Verifica che un conto (BANK o CREDIT_CARD) appartenga all'utente autenticato.
// Va chiamata PRIMA di scrivere qualunque accountId/ccAccountId ricevuto dal
// body: senza questo controllo un utente potrebbe agganciare le proprie
// transazioni/ricorrenti/pianificate/rate al conto di un altro utente (IDOR),
// corrompendone il saldo. Prisma con un valore undefined nel `where` omette
// il filtro — per questo la verifica è sempre esplicita, mai delegata a un
// findFirst con accountId potenzialmente assente.
export async function accountBelongsToUser(accountId: unknown, userId: string): Promise<boolean> {
  if (!accountId || typeof accountId !== 'string') return false;
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  return !!account;
}
