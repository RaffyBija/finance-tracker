import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAccounts } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { SkeletonPieChart } from '../shared/Skeleton';

// "Dove sono i tuoi soldi": composizione della liquidità per conto BANK.
// La CC è debito, non patrimonio → esclusa (coerente con project-account-semantics).

const FALLBACK = '#0d9488';

const isValidColor = (c?: string) => !!c && /^#[0-9A-Fa-f]{3,6}$/.test(c);

function CompositionTooltip({ active, payload }: any) {
  const { formatCurrency } = useFormatCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{payload[0].name}</p>
      <p className="dashboard-tooltip-amount">{formatCurrency(Number(payload[0].value))}</p>
    </div>
  );
}

export default function CompositionDonut() {
  const { data: accounts = [], isLoading } = useAccounts();
  const { formatCurrency } = useFormatCurrency();

  const { slices, total } = useMemo(() => {
    const bank = accounts.filter((a) => a.type !== 'CREDIT_CARD');
    const positives = bank.filter((a) => a.balance > 0);
    const sum = positives.reduce((s, a) => s + a.balance, 0);
    return { slices: positives, total: sum };
  }, [accounts]);

  if (isLoading) return <SkeletonPieChart />;

  return (
    <div className="card">
      <div className="widget-head">
        <h3 className="widget-title">Composizione del patrimonio</h3>
        <span className="widget-subtitle">Liquidità per conto</span>
      </div>

      {slices.length === 0 ? (
        <div className="dashboard-chart-empty">Nessun conto con liquidità positiva</div>
      ) : (
        <div className="dashboard-pie-body composition-pie-body">
          <div className="composition-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  cx="50%"
                  cy="50%"
                  innerRadius="56%"
                  outerRadius="86%"
                  dataKey="balance"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {slices.map((a) => (
                    <Cell key={a.id} fill={isValidColor(a.color) ? a.color : FALLBACK} />
                  ))}
                </Pie>
                <Tooltip content={<CompositionTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="dashboard-pie-legend-wrap">
            <div className="dashboard-legend">
              {slices.map((a) => (
                <div key={a.id} className="dashboard-legend-item">
                  <span
                    className="dashboard-legend-dot"
                    style={{ width: 10, height: 10, background: isValidColor(a.color) ? a.color : FALLBACK }}
                  />
                  <span className="dashboard-legend-name">{a.name}</span>
                  <span className="dashboard-legend-value">
                    {total > 0 ? Math.round((a.balance / total) * 100) : 0}%
                    <span className="composition-amount"> · {formatCurrency(a.balance)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
