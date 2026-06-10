import { lazy, type ComponentType } from 'react';

/**
 * Wrapper su React.lazy che gestisce il ChunkLoadError post-deploy.
 *
 * Dopo un deploy, una tab aperta da tempo può chiedere un chunk con un hash
 * non più esistente: l'import() viene rifiutato. In quel caso forziamo UN
 * reload (guardato da sessionStorage per evitare loop) così il browser
 * recupera index.html con gli hash nuovi. Se anche dopo il reload l'import
 * fallisce, l'errore viene propagato all'ErrorBoundary più vicino.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // Chiave globale per sessione: un solo reload automatico per sessione,
      // indipendentemente da quale chunk fallisce (anti-loop su deploy ripetuti).
      const KEY = 'chunk-reload';
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        // promise che non risolve: tiene il fallback mentre la pagina ricarica
        return new Promise<{ default: T }>(() => {});
      }
      throw err; // già ritentato una volta → propaga all'ErrorBoundary
    }
  });
}
