import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export function services() {
  for (const name of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[name]) throw new Error(`Configuração ausente no servidor: ${name}`);
  }
  return {
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY),
    db: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

function getPeriodEnd(subscription, priceId) {
  const item = subscription.items?.data?.find(i => i.price?.id === priceId);
  const seconds = item?.current_period_end ?? subscription.current_period_end;
  return Number.isFinite(Number(seconds)) && Number(seconds) > 0
    ? new Date(Number(seconds) * 1000).toISOString()
    : null;
}

export function planForSubscription(subscription) {
  const item = subscription.items?.data?.find(i =>
    [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_YEARLY].includes(i.price?.id)
  );
  if (!item || !['active', 'trialing'].includes(subscription.status)) return null;
  const expires = getPeriodEnd(subscription, item.price.id);
  if (!expires || Date.parse(expires) <= Date.now()) return null;
  return {
    plan: item.price.id === process.env.STRIPE_PRICE_MONTHLY ? 'monthly' : 'yearly',
    plan_expires_at: expires,
    stripe_subscription_id: subscription.id,
  };
}

/** Sempre lê o estado atual no Stripe: eventos antigos/duplicados não sobrescrevem um estado novo. */
export async function refreshCustomer({ stripe, db, customerId, expectedUserId = null }) {
  if (!customerId) throw new Error('Cliente Stripe não identificado');
  const query = db.from('profiles').select('id,stripe_customer_id').eq('stripe_customer_id', customerId);
  const { data: profile, error: profileError } = await query.maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error(`Nenhum perfil vinculado ao cliente Stripe ${customerId}`);
  if (expectedUserId && profile.id !== expectedUserId) throw new Error('Cliente Stripe não pertence ao usuário autenticado');

  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  // Para evitar um falso plano gratuito quando o cliente possui mais de 100 assinaturas,
  // interrompa e sinalize o caso raro em vez de tomar uma decisão incompleta.
  if (subscriptions.has_more) throw new Error('Cliente possui mais de 100 assinaturas; reconciliação manual necessária');
  const candidates = subscriptions.data.map(planForSubscription).filter(Boolean);
  candidates.sort((a, b) => Date.parse(b.plan_expires_at) - Date.parse(a.plan_expires_at));
  const best = candidates[0];
  const patch = best ?? { plan: 'free', plan_expires_at: null, stripe_subscription_id: null };
  const { data: updated, error: updateError } = await db.from('profiles')
    .update(patch).eq('id', profile.id).eq('stripe_customer_id', customerId)
    .select('id,plan,plan_expires_at').maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error('O banco não atualizou o perfil vinculado ao Stripe');
  return updated;
}

export function customerIdOf(event) {
  const object = event.data?.object;
  if (!object) return null;
  const customer = object.customer;
  return typeof customer === 'string' ? customer : customer?.id ?? null;
}
