import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  usersTable,
  productsTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { sendOrderStatusUpdate } from "../lib/email";

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

type OrderWithUser = typeof ordersTable.$inferSelect & {
  userEmail: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userPhone: string | null;
};

function formatOrderWithUser(o: OrderWithUser) {
  return {
    ...formatOrder(o),
    userEmail: o.userEmail ?? null,
    userName: [o.userFirstName, o.userLastName].filter(Boolean).join(" ") || null,
    userPhone: o.userPhone ?? null,
  };
}

router.get("/admin/dashboard", requireAdmin, async (req: any, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [[{ totalOrders }], [{ totalUsers }], [{ totalSales }], [{ pendingOrders }]] =
    await Promise.all([
      db.select({ totalOrders: sql<string>`COUNT(*)` })
        .from(ordersTable)
        .where(sql`created_at >= ${startOfMonth.toISOString()}`),
      db.select({ totalUsers: sql<string>`COUNT(*)` }).from(usersTable),
      db.select({ totalSales: sql<string>`COALESCE(SUM(total_amount), 0)` })
        .from(ordersTable)
        .where(sql`order_status = 'delivered' AND created_at >= ${startOfMonth.toISOString()}`),
      db.select({ pendingOrders: sql<string>`COUNT(*)` }).from(ordersTable).where(eq(ordersTable.orderStatus, "pending")),
    ]);

  const recentOrders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);

  const monthlySalesRaw = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'Mon ''YY') AS month,
      COALESCE(SUM(CASE WHEN order_status = 'delivered' THEN total_amount ELSE 0 END), 0) AS total,
      COUNT(*) AS orders
    FROM orders
    WHERE created_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(created_at, 'Mon ''YY'), DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at) ASC
  `);

  const monthlySales = (monthlySalesRaw.rows as any[]).map((r) => ({
    month: r.month as string,
    total: Number(r.total),
    orders: Number(r.orders),
  }));

  const salesByCategoryRaw = await db.execute(sql`
    SELECT
      p.category,
      COUNT(DISTINCT o.id) AS count,
      COALESCE(SUM(o.total_amount), 0) AS total
    FROM products p
    LEFT JOIN orders o ON o.order_status = 'delivered'
      AND o.items::text ILIKE '%"productId":' || p.id || '%'
    GROUP BY p.category
    ORDER BY total DESC
    LIMIT 10
  `);

  const salesByCategory = (salesByCategoryRaw.rows as any[]).map((r) => ({
    category: r.category as string,
    total: Number(r.total),
    count: Number(r.count),
  }));

  res.json({
    totalSales: Number(totalSales),
    totalOrders: Number(totalOrders),
    totalUsers: Number(totalUsers),
    pendingOrders: Number(pendingOrders),
    recentOrders: recentOrders.map(formatOrder),
    salesByCategory,
    monthlySales,
  });
});

router.get("/admin/orders", requireAdmin, async (req: any, res) => {
  const { status, page = "1" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = 20;
  const offset = (pageNum - 1) * limitNum;

  const baseSelect = {
    id: ordersTable.id,
    trackingId: ordersTable.trackingId,
    userId: ordersTable.userId,
    items: ordersTable.items,
    totalAmount: ordersTable.totalAmount,
    paymentMethod: ordersTable.paymentMethod,
    paymentStatus: ordersTable.paymentStatus,
    orderStatus: ordersTable.orderStatus,
    transactionId: ordersTable.transactionId,
    shippingAddress: ordersTable.shippingAddress,
    couponCode: ordersTable.couponCode,
    discountAmount: ordersTable.discountAmount,
    createdAt: ordersTable.createdAt,
    updatedAt: ordersTable.updatedAt,
    userEmail: usersTable.email,
    userFirstName: usersTable.firstName,
    userLastName: usersTable.lastName,
    userPhone: usersTable.phone,
  };

  let orders: OrderWithUser[];

  if (status) {
    orders = (await db
      .select(baseSelect)
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.userId, usersTable.clerkId))
      .where(eq(ordersTable.orderStatus, status))
      .orderBy(desc(ordersTable.createdAt))
      .limit(limitNum)
      .offset(offset)) as OrderWithUser[];
  } else {
    orders = (await db
      .select(baseSelect)
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.userId, usersTable.clerkId))
      .orderBy(desc(ordersTable.createdAt))
      .limit(limitNum)
      .offset(offset)) as OrderWithUser[];
  }

  res.json(orders.map(formatOrderWithUser));
});

router.put("/admin/orders/:id/status", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { orderStatus, cancellationReason } = req.body;

  // Fetch the existing order to check previous status
  const [existing] = await db
    .select({ orderStatus: ordersTable.orderStatus, items: ordersTable.items })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);

  // Prevent changing status once already delivered or cancelled
  if (existing?.orderStatus === "delivered") {
    res.status(400).json({ error: "Cannot change status of a delivered order" });
    return;
  }
  if (existing?.orderStatus === "cancelled") {
    res.status(400).json({ error: "Cannot change status of a cancelled order" });
    return;
  }

  const updateFields: Record<string, unknown> = { orderStatus, updatedAt: new Date() };
  if (orderStatus === "cancelled") {
    updateFields.cancellationReason = cancellationReason?.trim() || null;
  }

  const [order] = await db
    .update(ordersTable)
    .set(updateFields)
    .where(eq(ordersTable.id, id))
    .returning();

  // Auto-deduct stock when order is marked as delivered (only on transition)
  if (orderStatus === "delivered" && existing?.orderStatus !== "delivered") {
    const items = (existing?.items ?? []) as Array<{ productId: number; quantity: number }>;
    for (const item of items) {
      try {
        await db
          .update(productsTable)
          .set({ stock: sql`GREATEST(0, stock - ${item.quantity})` })
          .where(eq(productsTable.id, item.productId));
      } catch {
        // Non-blocking: log and continue
      }
    }
  }

  // Send status update email (non-blocking)
  if (order) {
    const [userRow] = await db
      .select({ email: usersTable.email, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.clerkId, order.userId))
      .limit(1);

    if (userRow?.email && !userRow.email.endsWith("@clerk.user")) {
      const name = [userRow.firstName, userRow.lastName].filter(Boolean).join(" ") || "Customer";
      sendOrderStatusUpdate({
        to: userRow.email,
        name,
        orderId: order.id,
        trackingId: order.trackingId,
        newStatus: orderStatus,
      }).catch(() => {});
    }
  }

  res.json(formatOrder(order));
});

router.put("/admin/orders/:id/payment", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { paymentStatus } = req.body;
  const [order] = await db
    .update(ordersTable)
    .set({ paymentStatus, updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();
  res.json(formatOrder(order));
});

router.get("/admin/users", requireAdmin, async (req: any, res) => {
  const usersRaw = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

  const orderCountsRaw = await db.execute(sql`
    SELECT user_id, COUNT(*) AS order_count
    FROM orders
    GROUP BY user_id
  `);
  const orderCountMap: Record<string, number> = {};
  for (const row of orderCountsRaw.rows as any[]) {
    orderCountMap[row.user_id] = Number(row.order_count);
  }

  res.json(
    usersRaw.map((u) => ({
      id: u.id,
      clerkId: u.clerkId,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      role: u.role,
      isBlocked: u.isBlocked,
      orderCount: orderCountMap[u.clerkId] ?? 0,
      createdAt: u.createdAt.toISOString(),
    }))
  );
});

router.put("/admin/users/:id/block", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { isBlocked } = req.body;
  const [user] = await db
    .update(usersTable)
    .set({ isBlocked, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
