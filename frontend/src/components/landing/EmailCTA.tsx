// CTA email della landing: input + bottone. Al submit valido naviga a /register
// con l'email pre-compilata (state). Niente stato "done" fittizio.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LandingCopy } from './landingCopy';

interface EmailCTAProps {
  t: LandingCopy;
  center?: boolean;
}

export default function EmailCTA({ t, center }: EmailCTAProps) {
  const [val, setVal] = useState('');
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = val.trim();
    if (email) navigate('/register', { state: { email } });
  };

  return (
    <form className={'cta' + (center ? ' cta-stack' : '')} onSubmit={submit}>
      <input
        className="field"
        type="email"
        required
        placeholder={t.emailPh}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        aria-label={t.emailPh}
      />
      <button className="btn teal" type="submit">{t.ctaBtn}</button>
    </form>
  );
}
