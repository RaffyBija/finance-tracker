interface FieldErrorProps {
  message?: string;
  /** Id dell'elemento errore, per collegarlo al campo via aria-describedby. */
  id?: string;
}

export default function FieldError({ message, id }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="text-xs text-danger-600 mt-1 flex items-center gap-1"
    >
      <span aria-hidden="true">⚠</span>
      {message}
    </p>
  );
}
