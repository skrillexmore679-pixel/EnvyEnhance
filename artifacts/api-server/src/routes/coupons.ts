import { Router } from "express";
import { db } from "@workspace/db";
import { couponsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

function formatCoupon(c: typeof couponsTable.$inferSelect) {
  return {
    id: c.id,
    code: c.code,
    discountType: c.discountType,
    discountValue: Number(c.discountValue),
    minOrderAmount: c.minOrderAmount != null ? Number(c.minOrderAmount) : null,
    expiryDate: c.expiryDate ? c.expiryDate.toISOString() : null,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

router.post("/coupons/validate", async (req, res) => {
  const { code, orderAmount } = req.body;
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, code.toUpperCase()))
    .limit(1);

  if (!coupon || !coupon.isActive) {
    res.status(404).json({ error: "Invalid or expired coupon" });
    return;
  }
  if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
    res.status(400).json({ error: "Coupon has expired" });
    return;
  }
  if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
    res.status(400).json({ error: `Minimum order amount is ${coupon.minOrderAmount}` });
    return;
  }
  res.json(formatCoupon(coupon));
});

router.get("/coupons", requireAdmin, async (req: any, res) => {
  const coupons = await db.select().from(couponsTable).orderBy(couponsTable.createdAt);
  res.json(coupons.map(formatCoupon));
});

router.post("/coupons", requireAdmin, async (req: any, res) => {
  const { code, discountType, discountValue, minOrderAmount, expiryDate } = req.body;
  const [coupon] = await db
    .insert(couponsTable)
    .values({
      code: code.toUpperCase(),
      discountType,
      discountValue: String(discountValue),
      minOrderAmount: minOrderAmount != null ? String(minOrderAmount) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    })
    .returning();
  res.status(201).json(formatCoupon(coupon));
});

router.put("/coupons/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { code, discountType, discountValue, minOrderAmount, expiryDate } = req.body;
  const [coupon] = await db
    .update(couponsTable)
    .set({
      code: code.toUpperCase(),
      discountType,
      discountValue: String(discountValue),
      minOrderAmount: minOrderAmount != null ? String(minOrderAmount) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    })
    .where(eq(couponsTable.id, id))
    .returning();
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  res.json(formatCoupon(coupon));
});

router.patch("/coupons/:id/toggle", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(couponsTable).where(eq(couponsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Coupon not found" }); return; }
  const [coupon] = await db
    .update(couponsTable)
    .set({ isActive: !existing.isActive })
    .where(eq(couponsTable.id, id))
    .returning();
  res.json(formatCoupon(coupon));
});

router.delete("/coupons/:id", requireAdmin, async (req: any, res) => {
  await db.delete(couponsTable).where(eq(couponsTable.id, parseInt(req.params.id)));
  res.json({ message: "Coupon deleted" });
});

export default router;
