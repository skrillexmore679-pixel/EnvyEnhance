import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, cartItemsTable, productsTable, couponsTable, usersTable, addressesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sendOrderConfirmation } from "../lib/email";
import crypto from "crypto";

const router = Router();

function formatOrder(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    trackingId: o.trackingId,
    userId: o.userId,
    items: o.items as any[],
    totalAmount: Number(o.totalAmount),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    transactionId: o.transactionId,
    shippingAddress: o.shippingAddress as any,
    couponCode: o.couponCode,
    discountAmount: Number(o.discountAmount),
    cancellationReason: o.cancellationReason ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

router.get("/orders", requireAuth, async (req: any, res) => {
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, req.userId))
    .orderBy(desc(ordersTable.createdAt));
  res.json(orders.map(formatOrder));
});

router.post("/orders", requireAuth, async (req: any, res) => {
  const { paymentMethod, transactionId, shippingAddress, couponCode } = req.body;

  const cartItems = await db
    .select({ cart: cartItemsTable, product: productsTable })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.userId, req.userId));

  if (cartItems.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  let subtotal = 0;
  const items = cartItems.map(({ cart, product }) => {
    const price = product.discountPrice != null ? Number(product.discountPrice) : Number(product.price);
    subtotal += price * cart.quantity;
    return {
      productId: product.id,
      productName: product.name,
      productImage: ((product.images as string[])[0]) ?? "",
      quantity: cart.quantity,
      price,
    };
  });

  let discountAmount = 0;
  if (couponCode) {
    const [coupon] = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.code, couponCode.toUpperCase()))
      .limit(1);
    if (coupon && coupon.isActive) {
      if (coupon.discountType === "percentage") {
        discountAmount = (subtotal * Number(coupon.discountValue)) / 100;
      } else {
        discountAmount = Number(coupon.discountValue);
      }
    }
  }

  const totalAmount = Math.max(0, subtotal - discountAmount);
  const trackingId = "SB" + crypto.randomBytes(4).toString("hex").toUpperCase();

  const paymentStatus = paymentMethod === "cod" ? "pending" : "pending_verification";

  const [order] = await db
    .insert(ordersTable)
    .values({
      trackingId,
      userId: req.userId,
      items,
      totalAmount: String(totalAmount),
      paymentMethod,
      paymentStatus,
      orderStatus: "pending",
      transactionId: transactionId ?? null,
      shippingAddress,
      couponCode: couponCode ?? null,
      discountAmount: String(discountAmount),
    })
    .returning();

  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, req.userId));

  // Auto-save shipping address to user's address book (non-blocking)
  const addr = shippingAddress as { fullName?: string; phone?: string; street?: string; city?: string; district?: string; postalCode?: string } | null;
  if (addr?.fullName && addr?.street && addr?.city) {
    try {
      const existing = await db.select().from(addressesTable).where(eq(addressesTable.userId, req.userId));
      const alreadySaved = existing.some(a => a.street === addr.street && a.city === addr.city);
      if (!alreadySaved) {
        await db.insert(addressesTable).values({
          userId: req.userId,
          fullName: addr.fullName ?? "",
          phone: addr.phone ?? "",
          street: addr.street ?? "",
          city: addr.city ?? "",
          district: addr.district ?? "",
          postalCode: addr.postalCode ?? null,
          isDefault: existing.length === 0,
        });
      }
    } catch (_) {}
  }

  // Send confirmation email (non-blocking — failure must not break the order response)
  const [userRow] = await db
    .select({ email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.userId))
    .limit(1);

  if (userRow?.email && !userRow.email.endsWith("@clerk.user")) {
    const name = [userRow.firstName, userRow.lastName].filter(Boolean).join(" ") || "Customer";
    sendOrderConfirmation({
      to: userRow.email,
      name,
      orderId: order.id,
      trackingId: order.trackingId,
      items,
      total: totalAmount,
      shippingAddress,
      paymentMethod,
    }).catch(() => {});
  }

  res.status(201).json(formatOrder(order));
});

router.get("/orders/track/:trackingId", async (req, res) => {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.trackingId, req.params.trackingId))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const statuses = ["pending", "confirmed", "processing", "shipped", "delivered"];
  const labels: Record<string, string> = {
    pending: "Order Placed",
    confirmed: "Order Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
  };

  const currentIdx = statuses.indexOf(order.orderStatus);
  const timeline = statuses.map((s, i) => ({
    status: s,
    label: labels[s] ?? s,
    timestamp: i <= currentIdx ? order.updatedAt.toISOString() : null,
    completed: i <= currentIdx,
  }));

  res.json({
    trackingId: order.trackingId,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    timeline,
  });
});

router.get("/orders/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, req.userId)))
    .limit(1);
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatOrder(order));
});

export default router;
