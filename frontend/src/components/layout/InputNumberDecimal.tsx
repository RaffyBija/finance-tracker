import { useState, useEffect } from 'react';

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
}

export const InputDecimal = ({
  setFormData,
  formData,
  label,
  field = 'amount',
  allowNegative = false,
  placeholder,
  required = false,
}: InputDecimalProps) => {
  const toRaw = (v: any) =>
    v !== 0 && v != null && v !== '' ? String(v).replace('.', ',') : '';

  const [rawAmount, setRawAmount] = useState<string>(toRaw(formData[field]));
  const [isFocused, setIsFocused] = useState(false);

  // Sincronizza con formData quando il campo non è in focus, oppure quando è
  // vuoto (popolamento all'apertura del modale: il campo può essere già
  // auto-focato ma senza valore digitato, quindi va comunque riempito).
  // Mentre l'utente digita (rawAmount non vuoto + focus) non viene clobberato.
  useEffect(() => {
    if (!isFocused || rawAmount === '') setRawAmount(toRaw(formData[field]));
  }, [formData[field], isFocused]);

  // Handle per correggere l'input numerico decimale al blur
  const handleFixNumberInput = () => {
    setIsFocused(false);
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

  return (
    <div className="form-group">
      <label className={`form-label${required ? ' form-label-required' : ''}`}>{label}</label>
      <input
        type="text"
        value={rawAmount}
        onChange={(e) => setRawAmount(handleNormalizeNumberInput(e.target.value))}
        onBlur={handleFixNumberInput}
        onFocus={(e) => {
          setIsFocused(true);
          if (e.target.value === '0') setRawAmount('');
        }}
        className="form-input"
        pattern={allowNegative ? '-?[0-9]*[.,]?[0-9]*' : '[0-9]*[.,]?[0-9]*'}
        inputMode="decimal"
        placeholder={placeholder}
      />
    </div>
  );
};
