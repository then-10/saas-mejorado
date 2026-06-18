/**
 * Notifica al dueño de la tienda cuando se confirma un pago.
 * Canales opcionales por variables de entorno (sin SDKs, solo fetch):
 *  - Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID
 *  - WhatsApp (Twilio): TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
 *    TWILIO_WHATSAPP_NUMBER (origen) + STORE_OWNER_WHATSAPP (destino)
 * Fallos de notificación NUNCA rompen el flujo de pago (Promise.allSettled).
 */
export async function notifyOwnerOfSale(params: {
  storeName: string;
  orderId: string;
  total: number;
  method: string;
}): Promise<void> {
  const text =
    `💰 Venta confirmada — ${params.storeName}\n` +
    `Pedido: ${params.orderId.slice(0, 8)}\n` +
    `Total: $${params.total.toFixed(2)} MXN\n` +
    `Método: ${params.method}`;

  await Promise.allSettled([sendTelegram(text), sendWhatsApp(text)]);
}

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendWhatsApp(text: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  const to = process.env.STORE_OWNER_WHATSAPP;
  if (!sid || !auth || !from || !to) return;

  const body = new URLSearchParams({ From: from, To: to, Body: text });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}
