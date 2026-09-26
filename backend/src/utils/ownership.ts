import prisma from './prisma';

// Verifica che un conto (BANK o CREDIT_CARD) appartenga all'utente autenticato.
// Va chiamata PRIMA di scrivere qualunque accountId/ccAccountId ricevuto dal
// body: senza questo controllo un utente potrebbe agganciare le proprie
// transazioni/ricorrenti/pianificate/rate al conto di un altro utente (IDOR),
// corrompendone il saldo. Prisma con un valore undefined nel `where` omette
// il filtro — per questo la verifica è sempre esplicita, mai delegata a un
// findFirst con accountId potenzialmente assente.
//
// Un conto archiviato non accetta nuovi movimenti: allowArchived serve solo a chi
// modifica un movimento storico lasciandolo sul suo conto (già archiviato).
export async function accountBelongsToUser(
  accountId: unknown,
  userId: string,
  opts: { allowArchived?: boolean } = {},
): Promise<boolean> {
  if (!accountId || typeof accountId !== 'string') return false;
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, ...(opts.allowArchived ? {} : { archivedAt: null }) },
    select: { id: true },
  });
  return !!account;
}

// Con almeno un conto, ogni movimento (transazione, ricorrente, pianificata e
// la transazione nata dalla loro registrazione) DEVE avere un conto: saldi,
// liquidità, proiezione e ritmo quotidiano contano solo le transazioni con
// conto, quindi un movimento senza conto sparirebbe da tutti i numeri. Gli
// utenti senza alcun conto restano liberi (comportamento storico).
export const ACCOUNT_REQUIRED_ERROR = 'Seleziona un conto';

export async function userHasAccounts(userId: string): Promise<boolean> {
  const count = await prisma.account.count({ where: { userId, archivedAt: null } });
  return count > 0;
}
