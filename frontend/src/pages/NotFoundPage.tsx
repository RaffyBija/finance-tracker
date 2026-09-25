import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="notfound-page">
      <div className="notfound-content">
        <p className="notfound-code">
          404
        </p>

        <h1 className="notfound-title">
          Pagina non trovata
        </h1>
        <p className="notfound-text">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>

        <div className="notfound-actions">
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
