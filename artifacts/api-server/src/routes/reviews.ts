import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, ordersTable, productsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

function formatReview(r: typeof reviewsTable.$inferSelect) {
  return {
    id: r.id,
    productId: r.productId,
    userId: r.userId,
    userName: r.userName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/reviews/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.productId, productId));
  res.json(reviews.map(formatReview));
});

// Check if the signed-in user can review this product
router.get("/reviews/:productId/eligibility", requireAuth, async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  const userId = req.userId as string;

  // Check if already reviewed
  const [existing] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.productId, productId), eq(reviewsTable.userId, userId)))
    .limit(1);

  if (existing) {
    res.json({ canReview: false, reason: "already_reviewed" });
    return;
  }

  // Check if user has a non-cancelled order containing this product
  const orders = await db
    .select({ id: ordersTable.id, items: ordersTable.items, orderStatus: ordersTable.orderStatus })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, userId),
        sql`order_status NOT IN ('cancelled')`
      )
    );

  const hasPurchased = orders.some((o) =>
    (o.items as any[]).some((item: any) => item.productId === productId)
  );

  if (!hasPurchased) {
    res.json({ canReview: false, reason: "not_purchased" });
    return;
  }

  res.json({ canReview: true, reason: null });
});

router.post("/reviews/:productId", requireAuth, async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  const { rating, comment } = req.body;
  const userId = req.userId as string;

  // Enforce: only one review per product
  const [existing] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.productId, productId), eq(reviewsTable.userId, userId)))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "You have already reviewed this product" });
    return;
  }

  // Enforce: user must have a non-cancelled order containing this product
  const orders = await db
    .select({ id: ordersTable.id, items: ordersTable.items })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, userId),
        sql`order_status NOT IN ('cancelled')`
      )
    );

  const hasPurchased = orders.some((o) =>
    (o.items as any[]).some((item: any) => item.productId === productId)
  );

  if (!hasPurchased) {
    res.status(403).json({ error: "You must purchase this product before writing a review" });
    return;
  }

  // Build display name: prefer firstName + lastName, fallback to email prefix
  const dbUser = req.dbUser;
  const fullName = `${dbUser?.firstName ?? ""} ${dbUser?.lastName ?? ""}`.trim();
  const userName = fullName || (dbUser?.email ? dbUser.email.split("@")[0] : "Customer");

  try {
    const [review] = await db
      .insert(reviewsTable)
      .values({ productId, userId, userName, rating, comment })
      .returning();
    res.status(201).json(formatReview(review));
  } catch {
    res.status(400).json({ error: "Failed to submit review" });
  }
});

router.put("/reviews/:reviewId", requireAuth, async (req: any, res) => {
  const reviewId = parseInt(req.params.reviewId);
  const { rating, comment } = req.body;
  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, reviewId)).limit(1);
  if (!review) { res.status(404).json({ error: "Not found" }); return; }
  if (review.userId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  const [updated] = await db
    .update(reviewsTable)
    .set({ rating, comment })
    .where(eq(reviewsTable.id, reviewId))
    .returning();
  res.json(formatReview(updated));
});

router.delete("/reviews/:productId/:reviewId", requireAuth, async (req: any, res) => {
  const reviewId = parseInt(req.params.reviewId);
  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, reviewId)).limit(1);
  if (!review) { res.status(404).json({ error: "Not found" }); return; }
  if (review.userId !== req.userId && req.dbUser?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(reviewsTable).where(eq(reviewsTable.id, reviewId));
  res.json({ message: "Review deleted" });
});

router.get("/admin/reviews", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: reviewsTable.id,
      productId: reviewsTable.productId,
      userId: reviewsTable.userId,
      userName: reviewsTable.userName,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
      productName: productsTable.name,
      productImage: sql<string>`${productsTable.images}->0`,
    })
    .from(reviewsTable)
    .leftJoin(productsTable, eq(reviewsTable.productId, productsTable.id))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    userId: r.userId,
    userName: r.userName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    productName: r.productName ?? "Unknown",
    productImage: r.productImage ?? null,
  })));
});

export default router;
