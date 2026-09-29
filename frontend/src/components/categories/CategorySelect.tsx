import type { Category, TransactionType } from '../../types';
import { buildCategoryTree } from '../../utils/categoryTree';

// Selettore nativo compatto, raggruppato per macro-categoria (optgroup). Per gli
// spazi stretti (righe di una transazione divisa, impostazioni) dove il pannello
// di CategoryPicker non ci sta; negli altri form si usa CategoryPicker.

interface CategorySelectProps {
  categories: Category[];
  type: TransactionType;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export default function CategorySelect({
  categories, type, value, onChange, placeholder = 'Categoria…', className = 'form-select', ariaLabel, disabled,
}: CategorySelectProps) {
  const tree = buildCategoryTree(categories.filter((c) => !c.archivedAt || c.id === value), type);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} aria-label={ariaLabel} disabled={disabled}>
      <option value="">{placeholder}</option>
      {tree.map(({ category, children }) =>
        children.length === 0 ? (
          <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
        ) : (
          <optgroup key={category.id} label={`${category.icon ?? ''} ${category.name}`.trim()}>
            <option value={category.id}>{category.name} (generale)</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}
