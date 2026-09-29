import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, ChevronRight, MoreVertical, Pencil, ArrowUp, ArrowDown, GitMerge, Archive, Trash2,
  RotateCcw, Lock, Wand2, BarChart3,
} from 'lucide-react';
import { useCategories, useArchiveCategory, useReorderCategories } from '../hooks/useCategories';
import { useSpendingAnalysis } from '../hooks/useAnalytics';
import { useBudgets } from '../hooks/useBudgets';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useToast } from '../contexts/ToastContext';
import CategoryFormModal from '../components/categories/CategoryFormModal';
import CategoryDeleteModal from '../components/categories/CategoryDeleteModal';
import OrganizeCategoriesModal from '../components/categories/OrganizeCategoriesModal';
import { SkeletonList, SkeletonPageHeader } from '../components/shared/Skeleton';
import { buildCategoryTree, matchesCategory, type CategoryNode } from '../utils/categoryTree';
import { categoryRows } from '../components/analysis/model';
import { periodLabel, spendTone } from '../components/analysis/ui';
import { signOf } from '../components/patrimonio/tone';
import type { Category, TransactionType } from '../types';

// Categorie come strumento: albero macro → sotto-categorie con la spesa del
// periodo in corso (rispetto alla media), il budget se c'è e gli utilizzi; azioni
// per modificare, spostare, riordinare, unire, archiviare ed eliminare senza mai
// lasciare movimenti orfani. "Organizza" raggruppa le categorie esistenti sotto le
// macro predefinite.

const NATURE_LABEL = { ESSENTIAL: 'Essenziale', DISCRETIONARY: 'Discrezionale' } as const;

type MenuAction = 'edit' | 'addChild' | 'up' | 'down' | 'merge' | 'archive' | 'delete';

function RowMenu({ category, isMacro, canUp, canDown, onAction }: {
  category: Category; isMacro: boolean; canUp: boolean; canDown: boolean; onAction: (a: MenuAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (category.isSystem) {
    return (
      <span className="category-row-system" title="Categoria gestita dal sistema">
        <Lock size={13} aria-hidden /> Sistema
      </span>
    );
  }

  const items: { a: MenuAction; label: string; icon: typeof Pencil; danger?: boolean; hidden?: boolean }[] = [
    { a: 'edit', label: 'Modifica', icon: Pencil },
    { a: 'addChild', label: 'Aggiungi sotto-categoria', icon: Plus, hidden: !isMacro },
    { a: 'up', label: 'Sposta su', icon: ArrowUp, hidden: !canUp },
    { a: 'down', label: 'Sposta giù', icon: ArrowDown, hidden: !canDown },
    { a: 'merge', label: 'Unisci in…', icon: GitMerge },
    { a: 'archive', label: 'Archivia', icon: Archive },
    { a: 'delete', label: 'Elimina', icon: Trash2, danger: true },
  ];

  return (
    <div className="category-menu-wrap" ref={ref}>
      <button
        type="button"
        className="category-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Azioni per ${category.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <ul className="category-menu" role="menu">
          {items.filter((i) => !i.hidden).map(({ a, label, icon: Icon, danger }) => (
            <li key={a} role="none">
              <button
                type="button"
                role="menuitem"
                className={`category-menu-item${danger ? ' is-danger' : ''}`}
                onClick={() => { setOpen(false); onAction(a); }}
              >
                <Icon size={14} aria-hidden /> {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const { formatCurrency } = useFormatCurrency();
  const toast = useToast();
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ open: boolean; editing: Category | null; parentId: string | null }>({ open: false, editing: null, parentId: null });
  const [removal, setRemoval] = useState<{ category: Category | null; mode: 'delete' | 'merge' }>({ category: null, mode: 'delete' });
  const [organizeOpen, setOrganizeOpen] = useState(false);

  const { data: all = [], isLoading } = useCategories('ALL', true);
  const { data: spending } = useSpendingAnalysis(3, 'pay');
  const { budgets } = useBudgets();
  const archiveMutation = useArchiveCategory();
  const reorderMutation = useReorderCategories();

  const active = useMemo(() => all.filter((c) => !c.archivedAt), [all]);
  const archived = useMemo(() => all.filter((c) => c.archivedAt && (!c.parentId || !all.find((p) => p.id === c.parentId)?.archivedAt)), [all]);
  const tree = useMemo(() => buildCategoryTree(active, type), [active, type]);

  // Spesa del periodo in corso e media per categoria (dal modello dell'Analisi).
  const stats = useMemo(() => {
    const map = new Map<string, { total: number; avg: number | null }>();
    if (!spending || spending.periods.length === 0) return map;
    for (const r of categoryRows(spending, spending.periods.length - 1)) map.set(r.id, { total: r.total, avg: r.avg });
    return map;
  }, [spending]);
  const statOf = (node: CategoryNode | Category) => {
    const ids = 'category' in node ? [node.category.id, ...node.children.map((c) => c.id)] : [node.id];
    let total = 0; let avg: number | null = null;
    for (const id of ids) {
      const s = stats.get(id);
      if (!s) continue;
      total += s.total;
      if (s.avg !== null) avg = (avg ?? 0) + s.avg;
    }
    return { total, avg };
  };

  const budgetByCat = useMemo(() => {
    const m = new Map<string, { amount: number; spent: number }>();
    for (const b of budgets) {
      if (b.categoryId) m.set(b.categoryId, { amount: b.effectiveAmount ?? Number(b.amount), spent: b.spent ?? 0 });
    }
    return m;
  }, [budgets]);

  const q = search.trim();
  const visibleTree = tree
    .map((n) => ({
      ...n,
      children: n.children.filter((c) => !q || matchesCategory(c, q, active)),
    }))
    .filter((n) => !q || matchesCategory(n.category, q, active) || n.children.length > 0);

  const needsOrganizing = active.some((c) => !c.isSystem && !c.parentId && !c.templateKey && !active.some((x) => x.parentId === c.id));

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const move = async (siblings: Category[], index: number, dir: -1 | 1) => {
    const ids = siblings.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try { await reorderMutation.mutateAsync(ids); } catch { toast.error('Impossibile riordinare'); }
  };

  const onAction = async (a: MenuAction, category: Category, siblings: Category[], index: number) => {
    if (a === 'edit') setForm({ open: true, editing: category, parentId: null });
    else if (a === 'addChild') setForm({ open: true, editing: null, parentId: category.id });
    else if (a === 'up') await move(siblings, index, -1);
    else if (a === 'down') await move(siblings, index, 1);
    else if (a === 'merge') setRemoval({ category, mode: 'merge' });
    else if (a === 'delete') setRemoval({ category, mode: 'delete' });
    else if (a === 'archive') {
      try {
        const res = await archiveMutation.mutateAsync({ id: category.id });
        toast.success(res.message);
      } catch (e: any) { toast.error(e.response?.data?.error || 'Impossibile archiviare'); }
    }
  };

  const restore = async (c: Category) => {
    try {
      const res = await archiveMutation.mutateAsync({ id: c.id, restore: true });
      toast.success(res.message);
    } catch (e: any) { toast.error(e.response?.data?.error || 'Impossibile ripristinare'); }
  };

  const renderRow = (c: Category, siblings: Category[], index: number, node?: CategoryNode) => {
    const isMacro = !!node;
    const s = node ? statOf(node) : statOf(c);
    const delta = s.avg === null ? null : s.total - s.avg;
    const tone = spendTone(delta);
    const budget = budgetByCat.get(c.id);
    const usage = (c._count?.transactions ?? 0) + (c._count?.transactionItems ?? 0);
    const open = node ? expanded.has(c.id) || !!q : false;
    return (
      <div className={`category-row${isMacro ? ' is-macro' : ' is-child'}`}>
        {isMacro ? (
          <button
            type="button"
            className={`category-row-toggle${open ? ' is-open' : ''}`}
            onClick={() => toggle(c.id)}
            aria-expanded={open}
            aria-label={open ? `Chiudi ${c.name}` : `Apri ${c.name}`}
            disabled={node!.children.length === 0}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        ) : <span className="category-row-indent" aria-hidden />}
        <span className="category-row-icon" style={{ backgroundColor: `${c.color ?? '#a8a29e'}22` }}>{c.icon || '•'}</span>
        <span className="category-row-body">
          <span className="category-row-name">
            {c.name}
            {isMacro && c.nature && <span className={`category-nature is-${c.nature.toLowerCase()}`}>{NATURE_LABEL[c.nature]}</span>}
          </span>
          <span className="category-row-meta">
            {isMacro && node!.children.length > 0 && `${node!.children.length} sotto-categorie · `}
            {usage} {usage === 1 ? 'movimento' : 'movimenti'}
            {budget && ` · budget ${formatCurrency(budget.amount)} (${Math.round((budget.spent / Math.max(budget.amount, 0.01)) * 100)}%)`}
          </span>
        </span>
        {type === 'EXPENSE' && (
          <span className="category-row-stats">
            <span className="category-row-total">{formatCurrency(s.total)}</span>
            <span className={`category-row-delta is-${tone}`}>
              {delta === null ? 'nessuna media' : `${signOf(delta)}${formatCurrency(Math.abs(delta))} vs media`}
            </span>
          </span>
        )}
        <RowMenu
          category={c}
          isMacro={isMacro}
          canUp={!q && index > 0}
          canDown={!q && index < siblings.length - 1}
          onAction={(a) => onAction(a, c, siblings, index)}
        />
      </div>
    );
  };

  return (
    <div className="container-custom">
      {isLoading ? (
        <>
          <SkeletonPageHeader />
          <SkeletonList rows={6} />
        </>
      ) : (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-header-title">Categorie</h1>
              <p className="page-header-subtitle">Macro-categorie e sotto-categorie, con la spesa del periodo in corso</p>
            </div>
            <div className="categories-header-actions">
              <Link to="/patrimonio#categorie" className="btn btn-ghost btn-md">
                <BarChart3 size={16} aria-hidden /> Analizza
              </Link>
              <button type="button" className={`btn ${needsOrganizing ? 'btn-primary' : 'btn-secondary'} btn-md`} onClick={() => setOrganizeOpen(true)}>
                <Wand2 size={16} aria-hidden /> Organizza
              </button>
            </div>
          </div>

          {needsOrganizing && (
            <div className="categories-notice">
              Alcune categorie non hanno una macro-categoria. Con <strong>Organizza</strong> le raggruppi sotto le macro predefinite in un passaggio.
            </div>
          )}

          <div className="categories-toolbar">
            <div className="form-button-group categories-type-toggle" role="group" aria-label="Tipo">
              <button type="button" className={`btn-toggle ${type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'}`} aria-pressed={type === 'EXPENSE'} onClick={() => setType('EXPENSE')}>
                Uscite
              </button>
              <button type="button" className={`btn-toggle ${type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'}`} aria-pressed={type === 'INCOME'} onClick={() => setType('INCOME')}>
                Entrate
              </button>
            </div>
            <input
              type="search"
              className="form-search categories-search"
              placeholder="Cerca categoria"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cerca categoria"
            />
            {type === 'EXPENSE' && spending && spending.periods.length > 0 && (
              <span className="categories-period">
                Periodo: {periodLabel(spending.periods[spending.periods.length - 1], spending.mode)}
              </span>
            )}
          </div>

          {visibleTree.length === 0 ? (
            <div className="empty-state-card">
              <p className="empty-state-title">{q ? 'Nessuna categoria trovata' : 'Nessuna categoria'}</p>
              {!q && (
                <>
                  <p className="empty-state-description">Parti dalle categorie predefinite: le puoi rinominare, spostare o archiviare quando vuoi.</p>
                  <button type="button" onClick={() => setOrganizeOpen(true)} className="btn btn-primary btn-md">
                    <Wand2 size={16} aria-hidden /> Aggiungi le predefinite
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className="category-tree">
              {visibleTree.map((node, i) => {
                const macros = visibleTree.map((n) => n.category);
                const open = expanded.has(node.category.id) || !!q;
                return (
                  <li key={node.category.id} className="category-tree-item">
                    {renderRow(node.category, macros, i, node)}
                    {open && node.children.length > 0 && (
                      <ul className="category-tree-children">
                        {node.children.map((c, ci) => (
                          <li key={c.id}>{renderRow(c, node.children, ci)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {archived.filter((c) => c.type === type).length > 0 && (
            <details className="archived-accounts">
              <summary className="archived-accounts-summary">
                <Archive size={15} /> Categorie archiviate ({archived.filter((c) => c.type === type).length})
              </summary>
              <p className="archived-accounts-hint">Non compaiono tra le scelte ma lo storico resta. Ripristinandole tornano disponibili.</p>
              <ul className="archived-accounts-list">
                {archived.filter((c) => c.type === type).map((c) => (
                  <li key={c.id} className="archived-account">
                    <span className="category-row-icon" style={{ backgroundColor: `${c.color ?? '#a8a29e'}22` }}>{c.icon || '•'}</span>
                    <span className="archived-account-body">
                      <span className="archived-account-name">{c.name}</span>
                      <span className="archived-account-meta">{(c._count?.transactions ?? 0) + (c._count?.transactionItems ?? 0)} movimenti</span>
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm archived-account-restore" onClick={() => restore(c)}>
                      <RotateCcw size={14} /> Ripristina
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {!isLoading && (
        <button className="fab" onClick={() => setForm({ open: true, editing: null, parentId: null })} aria-label="Nuova categoria">
          <Plus size={22} />
          <span className="fab-label">Nuova</span>
        </button>
      )}

      <CategoryFormModal
        isOpen={form.open}
        onClose={() => setForm({ open: false, editing: null, parentId: null })}
        categories={active}
        editingCategory={form.editing}
        defaultType={type}
        defaultParentId={form.parentId}
      />
      <CategoryDeleteModal
        category={removal.category}
        categories={active}
        mode={removal.mode}
        onClose={() => setRemoval({ category: null, mode: 'delete' })}
      />
      <OrganizeCategoriesModal isOpen={organizeOpen} onClose={() => setOrganizeOpen(false)} />
    </div>
  );
}
