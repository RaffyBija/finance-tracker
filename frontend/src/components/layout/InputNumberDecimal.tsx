import { useState, useEffect } from 'react';

interface InputDecimalProps {
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  formData: any;
  label: string;
}

export const InputDecimal = ({ setFormData, formData, label }: InputDecimalProps) => {
  const [rawAmount, setRawAmount] = useState<string>(
    formData.amount !== 0 ? formData.amount.toString().replace(".", ",") : ""
  );
  const [isFocused, setIsFocused] = useState(false);

  // Sincronizza con formData SOLO quando il campo non è in focus
  useEffect(() => {
    if (!isFocused) {
      setRawAmount(
        formData.amount !== 0 ? formData.amount.toString().replace(".", ",") : ""
      );
    }
  }, [formData.amount, isFocused]);

  //Handle per correggere l'input numerico decimale al blur
  const handleFixNumberInput = () => {
    setIsFocused(false);
    let value = rawAmount.trim();
    if (!value) {
      setFormData({ ...formData, amount: 0 });
      return;
    }
    value = value.replace(",", ".");
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setFormData({ ...formData, amount: parsed });
      setRawAmount(parsed.toString().replace(".", ","));
    }
  };

  //Handle per normalizzare l'input numerico decimale
  const handleNormalizeNumberInput = (value: string) => {
    //regex per accettare solo numeri e una virgola o punto e due numeri decimali
    const regex = /^[0-9]*[.,]?[0-9]{0,2}$/;
    if (!regex.test(value)) return rawAmount;
    return value;
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
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
        pattern="[0-9]*[.,]?[0-9]*"
        inputMode="decimal"
      />
    </div>
  );
};