import { services, refreshCustomer } from '../lib/billing.js';

/** Reparação segura, autenticada, para quem pagou antes da correção do webhook. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Entre com Google primeiro' });
    const { stripe, db } = services();
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Sessão inválida' });
    const { data: profile, error } = await db.from('profiles')
      .select('stripe_customer_id').eq('id', user.id).single();
    if (error) throw error;
    if (!profile?.stripe_customer_id) {
      return res.status(200).json({ plan: 'free', plan_expires_at: null });
    }
    const updated = await refreshCustomer({ stripe, db,
      customerId: profile.stripe_customer_id, expectedUserId: user.id });
    return res.status(200).json({ plan: updated.plan, plan_expires_at: updated.plan_expires_at });
  } catch (error) {
    console.error('sync-subscription', error.message);
    return res.status(500).json({ error: 'Falha ao consultar assinatura no Stripe' });
  }
}
