import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Entre com Google' });
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'PUBLIC_SITE_URL'];
    for (const name of required) if (!process.env[name]) throw new Error('Variável ausente: ' + name);
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Sessão inválida' });
    const plan = req.body?.plan;
    if (!['monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'Plano inválido' });
    const priceId = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
    if (!priceId) throw new Error('Preço Stripe não configurado');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { data: profile, error: profileError } = await db.from('profiles')
      .select('stripe_customer_id').eq('id', user.id).single();
    if (profileError) throw profileError;
    let customer = profile.stripe_customer_id;
    if (!customer) {
      const created = await stripe.customers.create({ email: user.email,
        metadata: { supabase_user_id: user.id } }, { idempotencyKey: 'imc-customer-' + user.id });
      customer = created.id;
      const { data: updated, error: updateError } = await db.from('profiles')
        .update({ stripe_customer_id: customer }).eq('id', user.id)
        .is('stripe_customer_id', null).select('stripe_customer_id').maybeSingle();
      if (updateError) throw updateError;
      if (!updated) {
        const { data: concurrent, error: concurrentError } = await db.from('profiles')
          .select('stripe_customer_id').eq('id', user.id).single();
        if (concurrentError || !concurrent?.stripe_customer_id) throw new Error('Não foi possível associar cliente Stripe');
        customer = concurrent.stripe_customer_id;
      }
    }
    const origin = process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
    if (!origin.startsWith('https://') && !origin.startsWith('http://localhost:')) {
      throw new Error('PUBLIC_SITE_URL deve ser HTTPS no Vercel');
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription', customer,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      success_url: origin + '/?checkout=success',
      cancel_url: origin + '/?checkout=cancel',
    });
    return res.status(200).json({ url: checkout.url });
  } catch (error) {
    console.error('checkout:', error.message);
    return res.status(500).json({ error: 'Não foi possível iniciar o checkout. Verifique as configurações no Vercel.' });
  }
}
