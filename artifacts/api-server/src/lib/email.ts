import { Resend } from "resend";

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

const FROM = "Sakura Beauty <onboarding@resend.dev>";
const REPLY_TO = "envyenhance@gmail.com";
const APP_URL = process.env.APP_URL ?? "https://sakurabeauty.store";

export async function sendOrderConfirmation({
  to,
  name,
  orderId,
  trackingId,
  items,
  total,
  shippingAddress,
  paymentMethod,
}: {
  to: string;
  name: string;
  orderId: number;
  trackingId: string;
  items: Array<{ productName: string; quantity: number; price: number }>;
  total: number;
  shippingAddress: any;
  paymentMethod: string;
}) {
  const resend = getClient();
  if (!resend) return;

  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${item.productName}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;font-size:13px;color:#6b7280;">×${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;font-weight:600;color:#111827;">৳${(item.price * item.quantity).toLocaleString()}</td>
    </tr>`
    )
    .join("");

  const addrHtml = shippingAddress
    ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;">
        <h3 style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;font-family:sans-serif;">Shipping To</h3>
        <p style="font-size:13px;color:#374151;margin:0;font-family:sans-serif;line-height:1.7;">
          <strong>${shippingAddress.fullName ?? ""}</strong><br/>
          ${shippingAddress.street ?? shippingAddress.line1 ?? ""}<br/>
          ${shippingAddress.city ?? ""}${shippingAddress.district ? ", " + shippingAddress.district : ""}
          ${shippingAddress.phone ? "<br/>📞 " + shippingAddress.phone : ""}
        </p>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:Georgia,serif;background:#fdf6f0;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#f43f5e,#ec4899);padding:32px 40px;text-align:center;">
      <h1 style="color:#fff;font-size:22px;margin:0;letter-spacing:0.04em;">🌸 Sakura Beauty</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;font-family:sans-serif;">Your order is confirmed!</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:16px;color:#374151;margin:0 0 6px;">Hi ${name},</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;font-family:sans-serif;line-height:1.6;">
        Thank you for your order! We've received it and will start preparing it shortly.
      </p>
      <div style="background:#fdf2f8;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;font-family:sans-serif;">
          <tr>
            <td>
              <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px;">Order ID</p>
              <p style="font-size:20px;font-weight:bold;color:#be185d;margin:0;">#${orderId}</p>
            </td>
            <td style="text-align:right;">
              <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px;">Tracking ID</p>
              <p style="font-size:13px;font-family:monospace;color:#374151;margin:0;">${trackingId}</p>
            </td>
          </tr>
        </table>
      </div>
      <h3 style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;font-family:sans-serif;">Items Ordered</h3>
      <table style="width:100%;border-collapse:collapse;font-family:sans-serif;">
        ${itemsHtml}
        <tr>
          <td colspan="2" style="padding:12px 0 0;font-family:sans-serif;font-size:13px;color:#6b7280;">Total (${paymentMethod === "cod" ? "Cash on Delivery" : paymentMethod})</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:bold;color:#be185d;font-size:18px;">৳${total.toLocaleString()}</td>
        </tr>
      </table>
      ${addrHtml}
      <div style="margin-top:28px;text-align:center;">
        <a href="${APP_URL}/orders" style="display:inline-block;background:#f43f5e;color:#fff;padding:12px 32px;border-radius:50px;font-size:14px;font-weight:600;text-decoration:none;font-family:sans-serif;">
          View My Orders
        </a>
      </div>
    </div>
    <div style="background:#fdf2f8;padding:16px 40px;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;font-family:sans-serif;">© 2025 Sakura Beauty · Japanese Luxury Beauty</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: [to],
      subject: `Your Sakura Beauty order #${orderId} is confirmed 🌸`,
      html,
    });
  } catch (err) {
    console.error("[email] sendOrderConfirmation failed:", err);
  }
}

export async function sendOrderStatusUpdate({
  to,
  name,
  orderId,
  trackingId,
  newStatus,
}: {
  to: string;
  name: string;
  orderId: number;
  trackingId: string;
  newStatus: string;
}) {
  const resend = getClient();
  if (!resend) return;

  const statusMap: Record<string, { emoji: string; heading: string; body: string }> = {
    confirmed: {
      emoji: "✅",
      heading: "Your order has been confirmed!",
      body: "Great news! Our team has confirmed your order and will begin preparing it for shipment.",
    },
    processing: {
      emoji: "⚙️",
      heading: "We're preparing your order",
      body: "Your order is being carefully prepared. We're packing your beauty products for dispatch.",
    },
    shipped: {
      emoji: "🚚",
      heading: "Your order is on its way!",
      body: "Your package has been shipped and is heading to you. Use your tracking ID to follow along.",
    },
    delivered: {
      emoji: "📦",
      heading: "Your order has been delivered!",
      body: "Your Sakura Beauty order has arrived! We hope you love your new products.",
    },
    cancelled: {
      emoji: "❌",
      heading: "Your order has been cancelled",
      body: "Your order has been cancelled. If you have questions, please contact our support team.",
    },
  };

  const info = statusMap[newStatus] ?? {
    emoji: "📋",
    heading: "Your order status has been updated",
    body: `Your order status is now: <strong>${newStatus}</strong>.`,
  };

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:Georgia,serif;background:#fdf6f0;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#f43f5e,#ec4899);padding:32px 40px;text-align:center;">
      <h1 style="color:#fff;font-size:22px;margin:0;letter-spacing:0.04em;">🌸 Sakura Beauty</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;font-family:sans-serif;">Order Update</p>
    </div>
    <div style="padding:32px 40px;text-align:center;">
      <p style="font-size:40px;margin:0 0 12px;">${info.emoji}</p>
      <h2 style="font-size:20px;color:#111827;margin:0 0 12px;font-family:Georgia,serif;">${info.heading}</h2>
      <p style="font-size:13px;color:#6b7280;font-family:sans-serif;line-height:1.6;margin:0 0 24px;">
        Hi ${name}, ${info.body}
      </p>
      <div style="background:#fdf2f8;border-radius:12px;padding:20px;display:inline-block;min-width:240px;margin-bottom:24px;">
        <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px;font-family:sans-serif;">Order</p>
        <p style="font-size:22px;font-weight:bold;color:#be185d;margin:0 0 8px;">#${orderId}</p>
        <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 2px;font-family:sans-serif;">Tracking ID</p>
        <p style="font-size:13px;font-family:monospace;color:#374151;margin:0;">${trackingId}</p>
      </div>
      <div>
        <a href="${APP_URL}/orders/${orderId}" style="display:inline-block;background:#f43f5e;color:#fff;padding:12px 32px;border-radius:50px;font-size:14px;font-weight:600;text-decoration:none;font-family:sans-serif;">
          View Order Details
        </a>
      </div>
    </div>
    <div style="background:#fdf2f8;padding:16px 40px;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;font-family:sans-serif;">© 2025 Sakura Beauty · Japanese Luxury Beauty</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: [to],
      subject: `${info.emoji} Order #${orderId} update — ${newStatus}`,
      html,
    });
  } catch (err) {
    console.error("[email] sendOrderStatusUpdate failed:", err);
  }
}
