import axios from 'axios';

/** Messaggio d'errore del backend (`{ error }`), altrimenti il testo di ripiego. */
export const apiError = (e: unknown, fallback: string): string =>
  (axios.isAxiosError(e) && e.response?.data?.error) || fallback;
