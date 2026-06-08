import { useState, useEffect, useRef } from 'react';

interface InputDecimalProps {
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  formData: any;
  label: string;
  /** Campo di formData da gestire. Default 'amount' (retro-compatibilità). */
  field?: string;
  /** Consente valori negativi (es. saldo iniziale in scoperto / credito CC). */
  allowNegative?: boolean;
  placeholder?: string;
  /** Mostra il marcatore di campo obbligatorio (asterisco) sulla label. */
  required?: boolean;
  /** Stato di validazione: marca l'input con aria-invalid per gli screen reader. */
  invalid?: boolean;
  /** Id del messaggio di errore da collegare via aria-describedby. */
  describedBy?: string;
  /** Variante "hero": importo come dato principale del form (cifra grande,
   *  tabular-nums, simbolo valuta in testa). Da usare per l'importo di una
   *  transazione, non per saldi/limiti secondari. */
  hero?: boolean;
  /** Simbolo valuta mostrato come adornment in testa al campo (solo `hero`). */
  currency?: string;
}

export const InputDecimal = ({
  setFormData,
  formData,
  label,
  field = 'amount',
  allowNegative = false,
  placeholder,
  required = false,
  invalid = false,
  describedBy,
  hero = false,
  currency,
}: InputDecimalProps) => {
  const toRaw = (v: any) =>
    v !== 0 && v != null && v !== '' ? String(v).replace('.', ',') : '';

  const [rawAmount, setRawAmount] = useState<string>(toRaw(formData[field]));

  // Ultimo valore esterno di formData[field] effettivamente sincronizzato.
  // Serve a distinguere una modifica ESTERNA (apertura modale, reset, cambio
  // elemento in edit) dalla digitazione dell'utente: mentre si digita cambia
  // solo `rawAmount`, NON formData[field] (committato solo onBlur).
  const lastSyncedRef = useRef(formData[field]);

  // Sincronizza solo quando formData[field] cambia davvero dall'esterno, a
  // prescindere dal focus. Necessario perché ModalBase auto-foca il primo
  // input all'apertura: senza questo, riaprendo il modale in edit il campo
  // resterebbe bloccato sul valore stale registrato al mount (formData del
  // parent viene popolato in un effect DOPO il mount dei figli).
  useEffect(() => {
    if (formData[field] !== lastSyncedRef.current) {
      lastSyncedRef.current = formData[field];
      setRawAmount(toRaw(formData[field]));
    }
  }, [formData[field]]);

  // Handle per correggere l'input numerico decimale al blur
  const handleFixNumberInput = () => {
    let value = rawAmount.trim();
    if (!value || value === '-') {
      setFormData({ ...formData, [field]: 0 });
      setRawAmount('');
      return;
    }
    value = value.replace(',', '.');
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setFormData({ ...formData, [field]: parsed });
      setRawAmount(parsed.toString().replace('.', ','));
    }
  };

  // Handle per normalizzare l'input numerico decimale
  const handleNormalizeNumberInput = (value: string) => {
    // regex: numeri, una virgola/punto, max due decimali; eventuale meno iniziale
    const regex = allowNegative
      ? /^-?[0-9]*[.,]?[0-9]{0,2}$/
      : /^[0-9]*[.,]?[0-9]{0,2}$/;
    if (!regex.test(value)) return rawAmount;
    return value;
  };

  const inputEl = (
    <input
      type="text"
      value={rawAmount}
      onChange={(e) => setRawAmount(handleNormalizeNumberInput(e.target.value))}
      onBlur={handleFixNumberInput}
      onFocus={(e) => {
        if (e.target.value === '0') setRawAmount('');
      }}
      className={hero ? 'amount-input' : 'form-input'}
      pattern={allowNegative ? '-?[0-9]*[.,]?[0-9]*' : '[0-9]*[.,]?[0-9]*'}
      inputMode="decimal"
      placeholder={placeholder}
      // Il <label> non avvolge l'input (gap a11y preesistente di questi form):
      // in hero portiamo la valuta nel nome accessibile, così lo screen reader
      // annuncia "Importo (€)" anche col simbolo mostrato solo come glifo.
      aria-label={hero && currency ? `${label} (${currency})` : undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    />
  );

  return (
    <div className="form-group">
      <label className={`form-label${required ? ' form-label-required' : ''}`}>{label}</label>
      {hero ? (
        <div className="amount-control" data-invalid={invalid || undefined}>
          {currency && <span className="amount-currency" aria-hidden="true">{currency}</span>}
          {inputEl}
        </div>
      ) : (
        inputEl
      )}
    </div>
  );
};
