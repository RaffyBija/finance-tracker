// Valute supportate (ISO 4217). Tenere allineato col backend
// (SUPPORTED_CURRENCIES in auth.controller.ts).
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

// Locale di formattazione associato a ciascuna valuta: governa separatori,
// posizione del simbolo e decimali. EUR resta it-IT (formato attuale dell'app).
const LOCALE_BY_CURRENCY: Record<string, string> = {
  EUR: 'it-IT',
  USD: 'en-US',
  GBP: 'en-GB',
  CHF: 'de-CH',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

export function localeForCurrency(currency: string): string {
  return LOCALE_BY_CURRENCY[currency] ?? 'it-IT';
}

// Opzioni per i selettori (profilo / registrazione).
export const CURRENCY_OPTIONS: { code: CurrencyCode; label: string }[] = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'Dollaro USA ($)' },
  { code: 'GBP', label: 'Sterlina britannica (£)' },
  { code: 'CHF', label: 'Franco svizzero (CHF)' },
  { code: 'JPY', label: 'Yen giapponese (¥)' },
  { code: 'CAD', label: 'Dollaro canadese (CA$)' },
  { code: 'AUD', label: 'Dollaro australiano (A$)' },
];

// Best-effort: deduce una valuta dal locale del browser (default EUR).
export function detectBrowserCurrency(): CurrencyCode {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const byRegion: Record<string, CurrencyCode> = {
      US: 'USD', GB: 'GBP', CH: 'CHF', JP: 'JPY', CA: 'CAD', AU: 'AUD',
    };
    if (region && byRegion[region]) return byRegion[region];
    return 'EUR';
  } catch {
    return 'EUR';
  }
}
