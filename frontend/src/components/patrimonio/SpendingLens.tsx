import CategoryPieWidget from '../dashboard/widgets/CategoryPieWidget';
import CategoryTrend from './CategoryTrend';

// Lente "Spese": la torta per categoria (mese singolo, autonomo) + il trend nel
// tempo (orizzonte di pagina). Insieme: "dove spendo questo mese" e "come cambia".

interface SpendingLensProps {
  months: number;
}

export default function SpendingLens({ months }: SpendingLensProps) {
  return (
    <div className="lens-stack">
      <CategoryPieWidget />
      <CategoryTrend months={months} />
    </div>
  );
}
