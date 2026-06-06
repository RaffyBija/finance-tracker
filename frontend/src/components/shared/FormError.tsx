interface FormErrorProps {
  message?: string | null;
}

/** Banner d'errore a livello di form (fallimenti di submit). Persistente e
 *  annunciato dagli screen reader (role="alert"), a differenza del toast
 *  transitorio. Si mostra in cima al form. */
export default function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <div className="form-error-banner" role="alert">
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </div>
  );
}
