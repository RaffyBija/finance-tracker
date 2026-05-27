import type { QueryClient } from '@tanstack/react-query';

const CHANNEL_NAME = 'finance-sync';

// Singleton per tab — il canale rimane aperto per tutta la vita dell'app
let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (_channel) return _channel;
  try {
    _channel = new BroadcastChannel(CHANNEL_NAME);
    return _channel;
  } catch {
    // Fallback silenzioso: ambienti senza BroadcastChannel (SSR, vecchi browser)
    return null;
  }
}

/**
 * Chiamato negli onSuccess delle mutation — invia le query key invalidate
 * a tutti gli altri tab aperti. Il tab mittente NON riceve il proprio messaggio.
 */
export function broadcastInvalidation(keys: string[]): void {
  getChannel()?.postMessage(keys);
}

/**
 * Chiamato una sola volta all'avvio in main.tsx — ascolta i broadcast
 * degli altri tab e invalida la cache locale di conseguenza.
 * Ritorna la funzione di cleanup.
 */
export function setupCrossTabSync(queryClient: QueryClient): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const handler = ({ data }: MessageEvent<string[]>) => {
    if (!Array.isArray(data)) return;
    data.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
