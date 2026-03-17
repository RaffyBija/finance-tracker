interface FieldErrorProps {
  message?: string;
}

export default function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="text-xs text-danger-600 mt-1 flex items-center gap-1">
      <span>⚠</span>
      {message}
    </p>
  );
}