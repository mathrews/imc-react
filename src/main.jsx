import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const db = url && anonKey ? createClient(url, anonKey) : null;

function validPremium(profile) {
  return ['monthly', 'yearly'].includes(profile?.plan) &&
    !!profile?.plan_expires_at && Date.parse(profile.plan_expires_at) > Date.now();
}
function Ad({ side }) {
  return <aside className={'ad ' + side} aria-label="Publicidade demonstrativa">
    <span>PUBLICIDADE</span><strong>Espaço reservado para anúncio</strong>
    <small>Banner demonstrativo · sem AdSense</small>
  </aside>;
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!db);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sessionRef = useRef(null);
  const premium = validPremium(profile);
  const checkoutReturn = new URLSearchParams(window.location.search).get('checkout') === 'success';

  useEffect(() => {
    if (!db) return;
    let alive = true;
    db.auth.getSession().then(({ data }) => {
      if (alive) { sessionRef.current = data.session; setSession(data.session); setAuthReady(true); }
    }).catch(() => { if (alive) setAuthReady(true); });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, next) => {
      sessionRef.current = next;
      setSession(next);
      setAuthReady(true);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const loadProfile = useCallback(async (userId) => {
    if (!db || !userId) return;
    const [p, h] = await Promise.all([
      db.from('profiles').select('id,display_name,plan,plan_expires_at').eq('id', userId).maybeSingle(),
      db.from('bmi_records').select('id,weight_kg,height_m,bmi,category,created_at')
        .order('created_at', { ascending: false }).limit(100),
    ]);
    if (sessionRef.current?.user?.id !== userId) return;
    if (p.error || h.error) setMessage(p.error?.message || h.error?.message);
    if (!p.error) setProfile(p.data);
    if (!h.error) setHistory(h.data || []);
  }, []);

  const synchronize = useCallback(async (accessToken, userId, showErrors = false) => {
    try {
      const response = await fetch('/api/sync-subscription', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken },
      });
      if (!response.ok) throw new Error(`Sincronização indisponível (${response.status})`);
      const data = await response.json();
      if (sessionRef.current?.user?.id !== userId) return;
      setProfile(prev => prev ? { ...prev, plan: data.plan, plan_expires_at: data.plan_expires_at } : prev);
      return data;
    } catch (error) {
      if (showErrors) setMessage('Não foi possível confirmar o plano no Stripe. ' + error.message);
      return null;
    }
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!db || !userId) { setProfile(null); setHistory([]); return; }
    // Consultar o Supabase primeiro: banners e layout não dependem do Stripe estar disponível.
    loadProfile(userId);
    // Reconciliação automática também recupera compras antigas com expires_at NULL.
    synchronize(session.access_token, userId);
    const channel = db.channel('profile-' + userId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId },
        () => loadProfile(userId))
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [session?.user?.id, session?.access_token, loadProfile, synchronize]);

  useEffect(() => {
    if (!checkoutReturn || !session?.user?.id) return;
    const { user, access_token } = session;
    let stopped = false;
    const retry = async () => {
      for (let i = 0; i < 5 && !stopped; i++) {
        const data = await synchronize(access_token, user.id, i === 4);
        if (data && ['monthly', 'yearly'].includes(data.plan)) {
          setMessage('Pagamento confirmado. Seu plano sem anúncios está ativo.');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1800));
      }
      if (!stopped) setMessage('Pagamento recebido pelo Stripe? Acesse a página novamente ou consulte os eventos de teste.');
    };
    retry();
    return () => { stopped = true; };
  }, [checkoutReturn, session?.user?.id, session?.access_token, synchronize]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const onFocus = () => { loadProfile(session.user.id); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session?.user?.id, loadProfile]);

  async function login() {
    if (!db) { setMessage('Configure Supabase no Vercel.'); return; }
    const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setMessage(error.message);
  }
  async function calculate(event) {
    event.preventDefault();
    setMessage('');
    const w = Number(weight.replace(',', '.'));
    const h = Number(height.replace(',', '.'));
    const usuario = session?.user?.id;
    setResult(null);
    try {
      const response = await fetch('/api/imc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peso: w, altura: h }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.erro || 'Falha no cálculo');
      if (sessionRef.current?.user?.id !== usuario) return;
      const bmi = data.imc;
      const classification = data.situacao;
      setResult({ bmi, category: classification });
      if (db && usuario) {
        const { data: record, error } = await db.from('bmi_records')
          .insert({ user_id: usuario, weight_kg: w, height_m: h, bmi, category: classification })
          .select('id,weight_kg,height_m,bmi,category,created_at').single();
        if (sessionRef.current?.user?.id !== usuario) return;
        if (error) setMessage('Não foi possível salvar: ' + error.message);
        else setHistory(prev => [record, ...prev].slice(0, 100));
      }
    } catch (error) {
      setMessage(error.message || 'Não foi possível calcular o IMC.');
    }
  }
  async function checkout(plan) {
    if (!session) { setMessage('Entre com Google antes de assinar.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro no checkout');
      window.location.assign(data.url);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <>
    <header><img src="/icon.svg" alt=""/><span>Meu IMC</span>
      <div className="account">{session ? <>
        <span>{profile?.display_name || session.user.email}</span>
        <button className="subtle" onClick={() => db.auth.signOut()}>Sair</button>
      </> : <button onClick={login}>Entrar com Google</button>}</div>
    </header>
    <div className={'layout ' + (premium ? 'layout--premium' : 'layout--ads')}>
      {!premium && <Ad side="left"/>}
      <main>
        <section className="hero"><span className="eyebrow">SAÚDE E BEM-ESTAR</span>
          <h1>Calcule seu IMC</h1><p>Informe seu peso e altura para conhecer seu índice de massa corporal.</p>
          {premium && <span className="premium-label">Plano sem anúncios ativo</span>}
        </section>
        <section className="panel"><form onSubmit={calculate}>
          <label>Peso (kg)<input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" placeholder="Ex.: 72,5" required/></label>
          <label>Altura (m)<input value={height} onChange={e => setHeight(e.target.value)} inputMode="decimal" placeholder="Ex.: 1,75" required/></label>
          <button className="primary" type="submit">Calcular IMC</button>
        </form>{result && <div className="result"><small>SEU RESULTADO</small>
          <strong>{result.bmi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          <span>{result.category}</span></div>}
          {message && <p className="message" role="status">{message}</p>}
        </section>
        <p className="disclaimer">O IMC é um indicador de triagem para adultos e não substitui avaliação profissional. Não interpreta adequadamente todos os perfis, incluindo crianças e gestantes.</p>
        {session && <section className="panel"><h2>Meu histórico</h2>
          {history.length ? history.map(item => <div className="history" key={item.id}>
            <span>{new Date(item.created_at).toLocaleDateString('pt-BR')} · {item.weight_kg} kg · {item.height_m} m</span>
            <strong>{Number(item.bmi).toFixed(2)} · {item.category}</strong>
          </div>) : <p>Nenhum cálculo salvo ainda.</p>}</section>}
        <section className="panel plans"><h2>Escolha seu plano</h2>
          <p>{premium ? 'Sua assinatura está ativa, sem publicidade.' : 'Você está no plano com anúncios.'}</p>
          <div className="plan-grid"><div className={premium ? 'plan-muted' : 'plan-current'}>
            <h3>Com anúncios</h3><strong>Grátis</strong><p>Uso livre com banners demonstrativos.</p>
          </div><div className={premium && profile.plan === 'monthly' ? 'plan-current' : ''}>
            <h3>Sem anúncios · mensal</h3><strong>R$ 4,90/mês</strong><p>Assinatura recorrente.</p>
            <button disabled={busy || (premium && profile.plan === 'monthly')} onClick={() => checkout('monthly')}>
              {premium && profile.plan === 'monthly' ? 'Plano atual' : 'Assinar mensal'}</button>
          </div><div className={premium && profile.plan === 'yearly' ? 'plan-current' : ''}>
            <h3>Sem anúncios · anual</h3><strong>R$ 34,90/ano</strong><p>Assinatura recorrente.</p>
            <button disabled={busy || (premium && profile.plan === 'yearly')} onClick={() => checkout('yearly')}>
              {premium && profile.plan === 'yearly' ? 'Plano atual' : 'Assinar anual'}</button>
          </div></div>
          {session && <p className="hint">Para gerenciar ou cancelar a assinatura, contate o suporte do projeto. Portal de autosserviço ainda não implementado.</p>}
        </section>
      </main>
      {!premium && <Ad side="right"/>}
    </div>
    {!premium && <div className="mobile-ad"><Ad side="bottom"/></div>}
    <footer>Meu IMC · Projeto demonstrativo React + Supabase + Stripe</footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
