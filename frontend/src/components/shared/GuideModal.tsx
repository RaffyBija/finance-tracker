import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import BaseModal from '../layout/ModalBase';

interface Section {
  title: string;
  emoji: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    title: 'Conti e Carte di credito',
    emoji: '🏦',
    content: (
      <>
        <p>Vai su <strong>Gestione → Conti</strong> per aggiungere conti bancari e carte di credito (fino a 3 sul piano gratuito, 10 sul piano Pro).</p>
        <p>Per le <strong>carte di credito</strong>: imposta il limite, il giorno di addebito mensile e il conto collegato. L'app ti avvisa automaticamente quando è il momento di registrare il pagamento mensile, azzerando il saldo della carta.</p>
        <p>Nella pagina Conti trovi due riquadri separati: <strong>Liquidità</strong> (somma dei conti bancari, denaro realmente disponibile) e <strong>Esposizione CC</strong> (spese sulla carta ancora da addebitare). La Dashboard mostra solo la liquidità perché quei fondi sono effettivamente tuoi — l'impatto futuro della CC è già visibile nella card Proiezione.</p>
      </>
    ),
  },
  {
    title: 'Transazioni',
    emoji: '💸',
    content: (
      <>
        <p>Registra ogni entrata e uscita con <strong>tipo</strong> (Entrata/Uscita), <strong>importo</strong>, <strong>categoria</strong>, <strong>data</strong> e <strong>conto</strong>.</p>
        <p>Nella lista Transazioni puoi <strong>filtrare per conto</strong> usando le pill in cima, oppure per tipo, periodo e testo libero.</p>
      </>
    ),
  },
  {
    title: 'Budget',
    emoji: '🎯',
    content: (
      <>
        <p>Crea budget per categoria con un importo massimo e un periodo (settimanale, mensile, annuale). La barra di avanzamento mostra quanto hai già speso rispetto al limite.</p>
        <p>I budget non bloccano le spese: ti informano in tempo reale quando ti avvicini al limite.</p>
      </>
    ),
  },
  {
    title: 'Transazioni ricorrenti',
    emoji: '🔁',
    content: (
      <>
        <p>Imposta entrate/uscite che si ripetono (<strong>settimanale, mensile, annuale</strong>). L'app calcola la prossima scadenza e ti avvisa ogni giorno al primo accesso.</p>
        <p>Dal modal di scadenza puoi selezionare quali eseguire e creare le transazioni reali in un click. Puoi anche eseguirle <strong>in anticipo</strong> dalla lista.</p>
      </>
    ),
  },
  {
    title: 'Transazioni pianificate',
    emoji: '📅',
    content: (
      <>
        <p>Pianifica uscite future (bollette, rate, spese previste). Appariranno nel Calendario e ti verranno ricordate quando la data si avvicina.</p>
        <p>Quando effettui il pagamento, usa <strong>Segna come pagato</strong>: viene creata automaticamente la transazione reale sul conto corretto.</p>
      </>
    ),
  },
  {
    title: 'Calendario',
    emoji: '🗓️',
    content: (
      <>
        <p>Vista mensile del cash flow: ogni giorno mostra le transazioni reali, pianificate e ricorrenti previste. Il saldo giornaliero è calcolato in tempo reale.</p>
        <p>Clicca su un giorno per vedere il dettaglio e il saldo progressivo fino a quella data.</p>
      </>
    ),
  },
  {
    title: 'Dashboard',
    emoji: '📊',
    content: (
      <>
        <p>La Dashboard mostra: liquidità disponibile, entrate/uscite del mese, trend mensile (bar chart), spese per categoria (pie chart), la card <strong>Andamento del saldo</strong> e le spese ricorrenti.</p>
        <p>La card <strong>Andamento del saldo</strong> ha due modalità: <strong>Impegni certi</strong> (solo ricorrenti, pianificate e addebiti CC programmati) e <strong>Stima realistica</strong> (aggiunge una stima delle spese abituali per categoria a fine mese).</p>
        <p>Usa le frecce per navigare i mesi storici e confrontare i trend.</p>
      </>
    ),
  },
];

function AccordionItem({ section, isOpen, onToggle }: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`guide-item${isOpen ? ' is-open' : ''}`}>
      <button className="guide-item-btn" onClick={onToggle} type="button">
        <span className="guide-item-label">
          <span className="guide-item-emoji">{section.emoji}</span>
          {section.title}
        </span>
        <ChevronDown size={16} className="guide-item-chevron" />
      </button>
      <div className={`guide-item-body${isOpen ? ' is-open' : ''}`}>
        <div className="guide-item-body-inner">
          <div className="guide-item-content">
            {section.content}
          </div>
        </div>
      </div>
    </div>
  );
}

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuideModal({ isOpen, onClose }: GuideModalProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIdx((prev) => (prev === i ? null : i));

  return (
    <BaseModal isOpen={isOpen} title="Guida all'app" onClose={onClose}>
      <div className="guide-scroll">
        <p className="guide-intro">
          Seleziona una sezione per scoprire come funziona ogni parte dell'app.
        </p>
        <div className="guide-accordion">
          {SECTIONS.map((section, i) => (
            <AccordionItem
              key={section.title}
              section={section}
              isOpen={openIdx === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>
    </BaseModal>
  );
}
