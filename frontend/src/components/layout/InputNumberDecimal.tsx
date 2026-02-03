import {useState} from 'react';

interface InputDecimalProps {
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    formData: any;
    label: string;
}

export const InputDecimal =({setFormData,formData,label}:InputDecimalProps) =>{
    const [rawAmount, setRawAmount] = useState<string>("");
    
    const handleFixNumberInput = () => {
        let value = rawAmount.trim();

        if (!value) return;

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
        if (!regex.test(value)) {
        return rawAmount;
        }
        return value;

    };
    return (
            <div className="form-group">
                <label className="form-label">{label}</label>
                <input
                    type="text"
                    value={rawAmount}
                    onChange={(e) => setRawAmount(handleNormalizeNumberInput(e.target.value))}
                    onBlur = {handleFixNumberInput}
                    onFocus={(e)=>{
                    e.target.value === '0' && (e.target.value = '')
                    }}
                    className="form-input"
                    pattern="[0-9]*[.,]?[0-9]*"
                    inputMode="decimal"
                    required
                />
            </div>);
}