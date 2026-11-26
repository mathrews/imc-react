import Stripe from 'stripe';
import { services, customerIdOf, refreshCustomer } from '../lib/billing.js';

// O Stripe exige o corpo bruto: não converter para JSON antes da verificação.
export const config = { api: { bodyParser: false } };
async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

const RELEVANT_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  let event;
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET ausente');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send('Assinatura de webhook inválida: ' + error.message);
  }

  if (!RELEVANT_EVENTS.has(event.type)) return res.status(200).json({ received: true, ignored: true });
  const customerId = customerIdOf(event);
  if (!customerId) return res.status(400).json({ error: 'Evento sem customer Stripe' });

  try {
    const { stripe, db } = services();
    const updated = await refreshCustomer({ stripe, db, customerId });
    console.info('Stripe conciliado', { event: event.type, eventId: event.id, plan: updated.plan });
    return res.status(200).json({ received: true });
  } catch (error) {
    // 500 faz o Stripe tentar novamente. Não responder 200 para atualização não realizada.
    console.error('Falha na conciliação Stripe', { event: event.type, eventId: event.id, detail: error.message });
    return res.status(500).json({ error: 'Falha ao sincronizar assinatura' });
  }
}
