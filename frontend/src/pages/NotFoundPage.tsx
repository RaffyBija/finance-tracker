import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-bold text-primary-200 mb-2 leading-none">
          404
        </p>

        <h1 className="text-2xl font-bold text-neutral-900 mb-3">
          Pagina non trovata
        </h1>
        <p className="text-neutral-500 mb-8">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-primary btn-md"
          >
            Vai alla Dashboard
          </button>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary btn-md"
          >
            Torna indietro
          </button>
        </div>
      </div>
    </div>
  );
}
