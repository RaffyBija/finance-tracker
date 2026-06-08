interface CharCountProps {
  value: string;
  max: number;
  /** Mostra il contatore solo oltre questa frazione del limite (default 80%). */
  threshold?: number;
}

/** Contatore caratteri discreto: resta nascosto finché il testo non si avvicina
 *  al limite, poi appare in tono muto e diventa danger all'ultimo carattere.
 *  Evita che l'utente scopra il limite solo al salvataggio. */
export default function CharCount({ value, max, threshold = 0.8 }: CharCountProps) {
  const len = value?.length ?? 0;
  if (len < max * threshold) return null;
  return (
    <p
      className={`form-char-count${len >= max ? ' is-limit' : ''}`}
      aria-live="polite"
    >
      {len}/{max}
    </p>
  );
}
