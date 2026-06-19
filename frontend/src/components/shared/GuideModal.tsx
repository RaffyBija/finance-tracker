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
        <p>La pagina principale elenca i tuoi <strong>conti bancari</strong>; un conto con una carta collegata mostra una piccola icona <strong>💳</strong>. Le carte non associate ad alcun conto compaiono in una sezione <strong>Carte di credito</strong> a parte. <strong>Tocca un conto</strong> per aprire la sua pagina dedicata: saldo, entrate/uscite del mese, proiezione di fine mese, ultime transazioni e le carte collegate.</p>
        <p>Per le <strong>carte di credito</strong>: imposta il limite, il <strong>giorno di chiusura</strong> del ciclo, il giorno di addebito e il conto collegato. Al giorno di chiusura l'app chiude il ciclo (le spese diventano un addebito pianificato) e ne apre uno nuovo; al giorno di addebito ti avvisa di registrare il pagamento.</p>
        <p>Tocca una carta (dalla pagina del conto o dalla sezione Carte) per la sua <strong>pagina dedicata</strong>: debito attuale, utilizzo del limite, prossimo addebito, ultime transazioni e lo <strong>Storico cicli</strong> direttamente in pagina. La chiusura del ciclo e l'avviso di pagamento sono <strong>automatici</strong> (al giorno di chiusura e al giorno di addebito).</p>
        <p>Ogni spesa appartiene al <strong>ciclo della sua data</strong>: se inserisci o modifichi una transazione vecchia, finisce nel ciclo giusto. Se quel ciclo era già stato pagato, la differenza viene riportata come <strong>conguaglio</strong> nel ciclo corrente.</p>
        <p>La <strong>Liquidità</strong> (somma dei conti bancari) è il denaro realmente disponibile; il debito delle carte è la tua <strong>esposizione</strong>, ancora da addebitare. La Dashboard mostra solo la liquidità perché quei fondi sono effettivamente tuoi — l'impatto futuro della CC è già visibile nella card Proiezione.</p>
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
        <p>Con due o più conti bancari, il pulsante <strong>Trasferisci</strong> (in cima alla pagina o nel dettaglio di un conto) sposta denaro da un conto all'altro: appare come un'unica riga <strong>⇄ Trasferimento</strong> e non viene conteggiato tra entrate e uscite, perché è solo uno spostamento interno.</p>
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
        <p>In cima trovi sempre l'<strong>Hero</strong> con la liquidità disponibile e le entrate/uscite del <strong>mese corrente</strong>. Sotto, una <strong>barra di azioni rapide</strong> (transazione, trasferimento, pianificata) e una fascia di <strong>tessere</strong> a colpo d'occhio: una per ogni carta di credito (debito e utilizzo), la prossima uscita, i budget a rischio.</p>
        <p>Tocca <strong>«Personalizza»</strong> in alto per <strong>mostrare/nascondere</strong> i riquadri e <strong>riordinarli</strong> con le frecce: barra azioni, tessere, andamento del saldo, in scadenza, budget, trend mensile, spese per categoria, transazioni recenti e spese ricorrenti. La tua scelta viene ricordata su questo dispositivo. Il <strong>selettore del mese</strong> vive sui soli widget analitici (es. Spese per categoria): l'Hero resta sempre sul presente.</p>
        <p>La card <strong>Andamento del saldo</strong> ha due modalità: <strong>Impegni certi</strong> (solo ricorrenti, pianificate e addebiti CC programmati) e <strong>Stima realistica</strong> (aggiunge una stima delle spese abituali per categoria a fine mese). Mostra un <strong>grafico</strong>: linea piena per la storia recente, tratteggiata per la proiezione futura.</p>
        <p>Tocca <strong>«Vedi dettaglio»</strong> per aprire la pagina <strong>Andamento del saldo</strong>: orizzonte esteso (fino a 24 mesi o intervallo personalizzato), <strong>dettaglio per voce</strong> degli impegni futuri e uno <strong>scenario «what-if»</strong> per simulare una variazione di liquidità oggi.</p>
        <p>Nel widget <strong>Spese per categoria</strong> usa le frecce per navigare i mesi e confrontare le uscite.</p>
      </>
    ),
  },
  {
    title: 'Profilo e valuta',
    emoji: '🪙',
    content: (
      <>
        <p>Apri il tuo <strong>profilo</strong> dall'avatar in alto a destra → <strong>Impostazioni</strong>: qui gestisci i dati account, la sicurezza e le <strong>preferenze</strong>.</p>
        <p>In <strong>Preferenze</strong> scegli la <strong>valuta</strong> usata in tutta l'app (€, $, £…): simbolo e formato degli importi si aggiornano <strong>ovunque all'istante</strong>, senza ricaricare.</p>
        <p>La valuta ti viene chiesta già in fase di <strong>registrazione</strong> (proposta in base alla lingua del dispositivo) e puoi cambiarla quando vuoi dal profilo.</p>
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
