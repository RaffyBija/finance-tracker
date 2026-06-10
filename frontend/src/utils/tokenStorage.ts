const TOKEN_KEY = 'token';

/**
 * Astrazione di storage per il token JWT.
 * Il token vive in UN SOLO storage alla volta:
 * - localStorage  → sessione persistente ("Resta connesso" attivo), sopravvive alla chiusura del browser
 * - sessionStorage → sessione effimera, si svuota chiudendo il browser
 */
export const getToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);

export const setToken = (token: string, remember: boolean): void => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};
