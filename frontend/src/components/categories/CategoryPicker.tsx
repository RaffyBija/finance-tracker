import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { ChevronDown, Search, Plus, Sparkles } from 'lucide-react';
import type { Category, TransactionType } from '../../types';
import { buildCategoryTree, categoryPath, matchesCategory, normalizeSearch } from '../../utils/categoryTree';
import { useCreateCategory } from '../../hooks/useCategories';
import { useToast } from '../../contexts/ToastContext';

// Selettore di categoria unico per tutti i form: ricerca, voci raggruppate per
// macro-categoria, recenti in cima, creazione al volo. Il pannello si apre DENTRO
// il form (non sovrapposto): funziona anche nel bottom sheet mobile.

interface CategoryPickerProps {
  categories: Category[];
  type: TransactionType;
  value: string;
  onChange: (id: string) => void;
  label?: string;
  hideLabel?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  suggested?: boolean;     // mostra il badge "Suggerita" sul valore corrente
  allowCreate?: boolean;
  placeholder?: string;
}

const RECENT_MAX = 4;
const recentKey = (type: TransactionType) => `recentCategories:${type}`;
const readRecent = (type: TransactionType): string[] => {
  try { return JSON.parse(localStorage.getItem(recentKey(type)) ?? '[]'); } catch { return []; }
};
const pushRecent = (type: TransactionType, id: string) => {
  try {
    const next = [id, ...readRecent(type).filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(type), JSON.stringify(next));
  } catch { /* storage non disponibile */ }
};

type Option =
  | { kind: 'empty' }
  | { kind: 'category'; category: Category; depth: 0 | 1; group: 'recent' | 'tree' }
  | { kind: 'create'; name: string };

export default function CategoryPicker({
  categories, type, value, onChange, label = 'Categoria', hideLabel = false, required = false,
  invalid = false, describedBy, allowEmpty = false, emptyLabel = 'Nessuna categoria',
  suggested = false, allowCreate = true, placeholder = 'Scegli una categoria',
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const labelId = useId();
  const createMutation = useCreateCategory();
  const toast = useToast();

  const ofType = useMemo(() => categories.filter((c) => c.type === type && !c.archivedAt), [categories, type]);
  const selected = categories.find((c) => c.id === value);

  const options: Option[] = useMemo(() => {
    const q = query.trim();
    const opts: Option[] = [];
    if (allowEmpty && !q) opts.push({ kind: 'empty' });
    if (!q) {
      const recent = readRecent(type)
        .map((id) => ofType.find((c) => c.id === id))
        .filter((c): c is Category => !!c);
      for (const c of recent) opts.push({ kind: 'category', category: c, depth: 0, group: 'recent' });
    }
    for (const node of buildCategoryTree(ofType)) {
      const macroMatch = matchesCategory(node.category, q, ofType);
      const kids = node.children.filter((c) => matchesCategory(c, q, ofType) || (q && normalizeSearch(node.category.name).includes(normalizeSearch(q))));
      if (macroMatch || kids.length > 0) opts.push({ kind: 'category', category: node.category, depth: 0, group: 'tree' });
      for (const c of kids) opts.push({ kind: 'category', category: c, depth: 1, group: 'tree' });
    }
    const exact = ofType.some((c) => normalizeSearch(c.name) === normalizeSearch(q));
    if (allowCreate && q && !exact) opts.push({ kind: 'create', name: q });
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ofType, allowEmpty, allowCreate, type, open]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);

  // Chiude cliccando fuori.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const choose = async (opt: Option) => {
    if (opt.kind === 'empty') {
      onChange('');
    } else if (opt.kind === 'category') {
      pushRecent(type, opt.category.id);
      onChange(opt.category.id);
    } else {
      try {
        const created = await createMutation.mutateAsync({ name: opt.name, type, icon: '📦', color: '#A8A29E' });
        pushRecent(type, created.id);
        onChange(created.id);
        toast.success(`Categoria "${created.name}" creata`);
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Impossibile creare la categoria');
        return;
      }
    }
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[active]) choose(options[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  let lastGroup: string | null = null;

  return (
    <div className="category-picker form-group" ref={rootRef}>
      {label && (
        <span id={labelId} className={`form-label${required ? ' form-label-required' : ''}${hideLabel ? ' category-picker-label-hidden' : ''}`}>
          {label}
          {suggested && value && (
            <span className="form-label-suggest"><Sparkles className="icon-xs" aria-hidden /> Suggerita</span>
          )}
        </span>
      )}
      <button
        type="button"
        className={`category-picker-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? labelId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <>
            <span className="category-picker-icon" style={{ backgroundColor: `${selected.color ?? '#a8a29e'}22` }}>{selected.icon || '•'}</span>
            <span className="category-picker-value">{categoryPath(selected, categories)}</span>
          </>
        ) : value ? (
          <span className="category-picker-value is-muted">Categoria archiviata</span>
        ) : (
          <span className="category-picker-value is-muted">{allowEmpty ? emptyLabel : placeholder}</span>
        )}
        <ChevronDown className="category-picker-chevron" size={16} aria-hidden />
      </button>

      {open && (
        <div className="category-picker-panel" onKeyDown={onKeyDown}>
          <div className="category-picker-search">
            <Search size={15} aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca o crea una categoria"
              aria-controls={listId}
              aria-activedescendant={options[active] ? optionId(active) : undefined}
              aria-label="Cerca categoria"
            />
          </div>
          <ul className="category-picker-list" role="listbox" id={listId} aria-labelledby={label ? labelId : undefined}>
            {options.length === 0 && <li className="category-picker-empty">Nessuna categoria</li>}
            {options.map((opt, i) => {
              const group = opt.kind === 'category' ? opt.group : opt.kind;
              const header = group === 'recent' && lastGroup !== 'recent'
                ? 'Recenti'
                : group === 'tree' && lastGroup === 'recent' ? 'Tutte' : null;
              lastGroup = group;
              const isActive = i === active;
              return [
                header && <li key={`h-${i}`} className="category-picker-group" role="presentation">{header}</li>,
                <li
                  key={i}
                  id={optionId(i)}
                  role="option"
                  aria-selected={opt.kind === 'category' ? opt.category.id === value : opt.kind === 'empty' ? !value : false}
                  className={[
                    'category-picker-option',
                    opt.kind === 'category' && opt.depth === 1 ? 'is-child' : '',
                    opt.kind === 'category' && opt.depth === 0 && opt.group === 'tree' ? 'is-macro' : '',
                    opt.kind === 'create' ? 'is-create' : '',
                    isActive ? 'is-active' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(opt); }}
                >
                  {opt.kind === 'empty' && <span className="category-picker-option-name">{emptyLabel}</span>}
                  {opt.kind === 'create' && (
                    <>
                      <Plus size={15} aria-hidden />
                      <span className="category-picker-option-name">Crea «{opt.name}»</span>
                    </>
                  )}
                  {opt.kind === 'category' && (
                    <>
                      <span className="category-picker-icon" style={{ backgroundColor: `${opt.category.color ?? '#a8a29e'}22` }}>
                        {opt.category.icon || '•'}
                      </span>
                      <span className="category-picker-option-name">
                        {opt.group === 'recent' ? categoryPath(opt.category, categories) : opt.category.name}
                      </span>
                    </>
                  )}
                </li>,
              ];
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
