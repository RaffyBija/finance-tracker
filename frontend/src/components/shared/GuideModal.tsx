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
        <p>Vai su <strong>Conti</strong> (nella barra principale, anche nella barra in basso su mobile) per aggiungere conti bancari e carte di credito (fino a 3 sul piano gratuito, 10 sul piano Pro).</p>
        <p>La pagina principale elenca i tuoi <strong>conti bancari</strong>; un conto con una carta collegata mostra una piccola icona <strong>💳</strong>. Le carte non associate ad alcun conto compaiono in una sezione <strong>Carte di credito</strong> a parte. <strong>Tocca un conto</strong> per aprire la sua pagina dedicata: saldo, entrate/uscite del mese, proiezione di fine mese, ultime transazioni e le carte collegate.</p>
        <p>Ogni movimento appartiene a un <strong>conto</strong>. Eliminando un conto che ha già dei movimenti, il conto viene <strong>archiviato</strong>: sparisce da liste e selettori ma lo <strong>storico</strong> delle sue transazioni resta (patrimonio e statistiche non cambiano), e le <strong>scadenze future</strong> e le carte collegate passano al <strong>conto principale</strong>. Prima va portato il saldo a zero, ad esempio con un trasferimento.</p>
        <p>Per le <strong>carte di credito</strong>: imposta il limite, il <strong>giorno di chiusura</strong> del ciclo, il giorno di addebito e il conto collegato. Al giorno di chiusura l'app chiude il ciclo (le spese diventano un addebito pianificato) e ne apre uno nuovo; al giorno di addebito ti avvisa di registrare il pagamento.</p>
        <p>Tocca una carta (dalla pagina del conto o dalla sezione Carte) per la sua <strong>pagina dedicata</strong>: debito attuale, utilizzo del limite, prossimo addebito, ultime transazioni e lo <strong>Storico cicli</strong> direttamente in pagina. La chiusura del ciclo e l'avviso di pagamento sono <strong>automatici</strong> (al giorno di chiusura e al giorno di addebito).</p>
        <p>Ogni spesa appartiene al <strong>ciclo della sua data</strong>: se inserisci o modifichi una transazione vecchia, finisce nel ciclo giusto. Se quel ciclo era già stato pagato, la differenza viene riportata come <strong>conguaglio</strong> nel ciclo corrente.</p>
        <p>Gli addebiti di saldo carta usano una categoria <strong>«Pagamento Carta»</strong> gestita dal sistema (visibile tra le Categorie con l'etichetta <em>Sistema</em>, non modificabile): così sono sempre tracciabili e vengono esclusi dalle medie delle proposte di budget, per non gonfiare i tuoi consumi reali.</p>
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
        <p>Per un'uscita che copre più voci (es. al bar: <strong>caffè + sigarette</strong>) tocca <strong>«Dividi su più categorie»</strong>: ripartisci l'importo su più righe, ciascuna con la sua categoria. Resta un unico movimento, ma ogni parte conta nella categoria e nel budget giusti.</p>
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
        <p>Crea budget per categoria con un importo massimo e un periodo (settimanale, mensile, annuale). La barra di avanzamento mostra quanto hai già speso nel <strong>periodo corrente</strong> rispetto al limite.</p>
        <p>Il budget si <strong>azzera automaticamente</strong> a ogni periodo: non devi spostare nessuna data. Tocca una card per aprire il <strong>dettaglio con lo storico</strong> — budget contro spesa reale dei periodi passati, media, aderenza e sforamenti.</p>
        <p>Puoi attivare il <strong>riporto a fine periodo</strong>: con <strong>«Solo avanzo»</strong> ciò che non spendi si somma al periodo successivo; con <strong>«Avanzo e sforamento»</strong> si riporta anche il debito, riducendo il budget se hai speso troppo. La card mostra <em>«+€X dal periodo scorso»</em> e la barra tiene conto del budget effettivo.</p>
        <p>I budget monitorano la spesa <strong>discrezionale</strong> (non gli impegni fissi come rate e abbonamenti) e non bloccano le spese: ti informano in tempo reale quando ti avvicini al limite.</p>
        <p>In cima alla pagina una <strong>fascia di riepilogo</strong> mostra a colpo d'occhio quanto hai <strong>budgetato, speso e rimanente</strong> tra i budget attivi, più lo <strong>spendibile del mese</strong>.</p>
        <p>Con <strong>«Proponi budget»</strong> l'app calcola lo <strong>spendibile del mese</strong> (entrate previste + liquidità − impegni fissi − la tua <strong>% di risparmio</strong>) e suggerisce un tetto per ogni categoria dalle tue medie. Puoi scegliere se pianificare <strong>questo mese o il prossimo</strong> (a fine mese ti propone già il prossimo, col cuscinetto proiettato) e quali <strong>conti includere</strong> nel calcolo (escludi ad esempio i risparmi). Scegli quali budget creare o aggiornare e ritocca gli importi prima di applicarli. La percentuale di risparmio si imposta in <strong>Impostazioni → Preferenze</strong>.</p>
      </>
    ),
  },
  {
    title: 'Scadenzario',
    emoji: '📅',
    content: (
      <>
        <p>Lo <strong>Scadenzario</strong> (in <strong>Gestione</strong>, o <strong>Menu → Gestione</strong> su mobile) è il registro unico dei tuoi <strong>movimenti futuri</strong>, in entrata e in uscita. Ha quattro schede: <strong>Piani a rate</strong>, <strong>Pianificate</strong>, <strong>Ricorrenti</strong> e <strong>Sospesi</strong>.</p>
        <p><strong>Piani a rate</strong> — per un debito o un credito <strong>dilazionato</strong>, anche a importo diverso per scadenza. Un <strong>Debito</strong> (es. un <strong>acquisto a rate</strong> o una tassa rateizzata) è una serie di uscite future; un <strong>Credito</strong> sono soldi che ti devono <strong>tornare</strong> (es. una spesa divisa con gli amici, con la <strong>controparte</strong> su ogni rata). Le rate puoi inserirle una a una oppure <strong>generarle da un totale</strong> (N rate mensili di pari importo) e poi ritoccare importi e date. La card mostra l'avanzamento <strong>«X su Y»</strong>, il residuo e la prossima rata; <strong>toccala</strong> per aprire il dettaglio con tutte le rate. Da lì puoi <strong>pagare più rate insieme</strong>: con la stessa data confluiscono in <strong>un'unica transazione</strong>. Nel piano scegli come paghi: <strong>addebito diretto</strong> (domiciliazione, es. un finanziamento: il conto è fisso ed entra nella proiezione di quel conto) oppure <strong>pagamento manuale</strong> (es. bollettini o F24 che paghi ogni volta da un conto diverso: il conto lo indichi quando registri la rata).</p>
        <p><strong>Pianificate</strong> — singole uscite o entrate future (bollette, spese previste). Con <strong>«Segna come pagato»</strong> viene creata automaticamente la transazione reale sul conto corretto, con la <strong>data prevista</strong> (correggibile se il pagamento è avvenuto in un altro giorno).</p>
        <p><strong>Ricorrenti</strong> — entrate/uscite che si ripetono (<strong>settimanale, mensile, annuale</strong>). L'app calcola la prossima scadenza; puoi eseguirle in un click, anche <strong>in anticipo</strong>.</p>
        <p><strong>Sospesi</strong> — importi di cui conosci la cifra ma non ancora la <strong>data</strong> (es. un rimborso in arrivo, un debito che salderai ma non sai quando). Non compaiono in calendario o dashboard, e nella Proiezione solo se attivi esplicitamente <strong>«Includi sospesi»</strong> (stima, contati come se accadessero oggi). Puoi <strong>segnarli come incassati/pagati</strong> indicando la data al momento, oppure <strong>aggiungere una data</strong> modificandoli: da quel momento diventano una Pianificata a tutti gli effetti.</p>
        <p><strong>Promemoria «Scadenze da registrare»</strong> — al primo accesso della giornata un unico popup raccoglie tutto ciò che è in scadenza oggi o arretrato: <strong>ricorrenti, pianificate, rate e addebiti della carta</strong>. Se il movimento è già avvenuto (es. un <strong>addebito diretto</strong> sul conto) lo registri in un tocco, senza inserirlo a mano. Ogni voce usa la sua <strong>data prevista</strong>; se il pagamento è arrivato in un altro giorno, <strong>tocca la data</strong> per correggerla. Le scadenze più vecchie di una settimana non sono preselezionate: spuntale solo se le hai davvero pagate. «Salta oggi» lo rimanda a domani: nel frattempo il badge nel menu resta visibile, e in cima a ogni scheda (Ricorrenti, Pianificate, Piani a rate) un banner <strong>«Rivedi e registra»</strong> riapre lo stesso riepilogo filtrato su quella scheda.</p>
        <p>Tutto ciò che inserisci qui (tranne i Sospesi finché restano senza data) confluisce nella <strong>Proiezione del saldo</strong> e nel <strong>Calendario</strong>, così vedi in anticipo l'impatto sui tuoi conti.</p>
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
        <p>La card <strong>Andamento del saldo</strong> ha due modalità: <strong>Impegni certi</strong> (solo ricorrenti, pianificate e addebiti CC programmati) e <strong>Stima realistica</strong>, che ragiona <strong>fino al prossimo stipendio</strong>: aggiunge agli impegni il tuo <strong>ritmo quotidiano</strong> (le spese variabili, stimate dagli ultimi periodi di paga) e ti mostra la liquidità stimata il giorno prima dell'accredito con una fascia probabile, il <strong>punto più basso</strong>, quanto puoi <strong>spendere al giorno</strong> senza andare sotto zero e il minimo previsto <strong>per ogni conto</strong>.</p>
        <p>Tocca <strong>«Vedi dettaglio»</strong> per aprire la pagina <strong>Andamento del saldo</strong>: parte dall'orizzonte <strong>«Stipendio»</strong> (fino al prossimo accredito, con il saldo <strong>prima dello stipendio</strong> e il punto più basso), oppure fino a 24 mesi o un intervallo personalizzato. Attiva <strong>«Includi ritmo quotidiano»</strong> per vedere accanto alla linea degli impegni una seconda linea con le spese variabili stimate: puoi anche impostare a mano il tuo ritmo al giorno. In più: <strong>dettaglio per voce</strong> degli impegni futuri e uno <strong>scenario «what-if»</strong> per simulare una variazione di liquidità oggi.</p>
        <p>Il <strong>periodo di paga</strong> si imposta in <strong>Impostazioni → Preferenze</strong>: scegli la <strong>categoria dello stipendio</strong> (il prossimo accredito viene letto dalla pianificata o ricorrente di quella categoria, i periodi passati dagli accrediti registrati) e un <strong>giorno di paga</strong> di riserva.</p>
        <p>Nel widget <strong>Spese per categoria</strong> usa le frecce per navigare i mesi e confrontare le uscite.</p>
      </>
    ),
  },
  {
    title: 'Analisi',
    emoji: '🔍',
    content: (
      <>
        <p>La pagina <strong>Analisi</strong> (dal menu <strong>Analisi</strong>) serve a capire a fondo le tue spese e quanto possiedi. Guarda al passato e al presente; per il futuro c'è la <strong>Proiezione</strong>.</p>
        <p>Scegli come dividere il tempo: per <strong>periodo di paga</strong> (da uno stipendio al successivo, se l'hai impostato in Preferenze) oppure per <strong>mese</strong>, quanti periodi confrontare (3, 6 o 12) e, con le frecce, quale periodo analizzare. Le spese con carta contano alla <strong>data d'acquisto</strong>; trasferimenti e addebiti carta sono esclusi, così nulla viene contato due volte.</p>
        <p>Ogni spesa ha una <strong>natura</strong>: <strong>fissa</strong> (generata da una ricorrente), <strong>programmata</strong> (pianificate e rate) o <strong>variabile</strong> (tutto il resto, il ritmo quotidiano).</p>
        <p><strong>Spese</strong>: quanto hai speso rispetto alla media degli altri periodi (per il periodo in corso il confronto è <strong>alla stessa data</strong>), la composizione per natura, le spese variabili al giorno, il risparmio e una <strong>stima a fine periodo</strong>. <strong>Categorie</strong>: ogni categoria con l'andamento e lo scostamento dalla media, gli scostamenti notevoli segnalati; tocca una categoria per vederne i movimenti e le voci più ricorrenti. <strong>Abitudini</strong>: in quali giorni della settimana spendi di più, il calendario del periodo, le fasce d'importo e le voci che tornano spesso. <strong>Patrimonio</strong>: il <strong>patrimonio netto</strong> (liquidità più crediti, meno debito carte, rate residue e sospesi) e l'andamento della liquidità, anche per conto.</p>
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
