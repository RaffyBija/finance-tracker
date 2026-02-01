import CookieConsent from 'react-cookie-consent';
import { Link } from 'react-router-dom';

export const CookieBanner = () => {
  return (
    <CookieConsent
      location="bottom"
      buttonText="Accetta"
      declineButtonText="Rifiuta"
      enableDeclineButton
      cookieName="financeTrackerConsent"
      style={{ background: '#2B373B' }}
      buttonStyle={{ 
        background: '#4CAF50', 
        color: '#fff', 
        fontSize: '14px',
        borderRadius: '4px',
        padding: '10px 20px'
      }}
      declineButtonStyle={{
        background: '#f44336',
        color: '#fff',
        fontSize: '14px',
        borderRadius: '4px',
        padding: '10px 20px'
      }}
      expires={365}
    >
      Questo sito utilizza cookie per migliorare l'esperienza utente.{' '}
      <Link to="/privacy" className="underline">
        Leggi la Privacy Policy
      </Link>
    </CookieConsent>
  );
};