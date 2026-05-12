import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, addressesTable, reviewsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    isBlocked: u.isBlocked,
    createdAt: u.createdAt.toISOString(),
  };
}

function formatAddress(a: typeof addressesTable.$inferSelect) {
  return {
    id: a.id,
    userId: a.userId,
    fullName: a.fullName,
    phone: a.phone,
    street: a.street,
    city: a.city,
    district: a.district,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
  };
}

router.get("/users/me", requireAuth, async (req: any, res) => {
  res.json(formatUser(req.dbUser));
});

router.put("/users/me", requireAuth, async (req: any, res) => {
  const { firstName, lastName, phone, email } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined && email && !email.endsWith("@clerk.user")) updates.email = email;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.dbUser.id))
    .returning();

  // Back-fill userName on existing reviews when a real name becomes available.
  // Only update reviews that still have a placeholder or anonymous-looking name.
  const newFirst = (firstName ?? req.dbUser.firstName ?? "").trim();
  const newLast = (lastName ?? req.dbUser.lastName ?? "").trim();
  const fullName = `${newFirst} ${newLast}`.trim();

  if (fullName) {
    await db
      .update(reviewsTable)
      .set({ userName: fullName })
      .where(eq(reviewsTable.userId, req.userId));
  }

  res.json(formatUser(updated));
});

router.get("/users/me/addresses", requireAuth, async (req: any, res) => {
  const addresses = await db
    .select()
    .from(addressesTable)
    .where(eq(addressesTable.userId, req.userId));
  res.json(addresses.map(formatAddress));
});

router.post("/users/me/addresses", requireAuth, async (req: any, res) => {
  const { fullName, phone, street, city, district, postalCode, isDefault } = req.body;
  if (isDefault) {
    await db
      .update(addressesTable)
      .set({ isDefault: false })
      .where(eq(addressesTable.userId, req.userId));
  }
  const [address] = await db
    .insert(addressesTable)
    .values({ userId: req.userId, fullName, phone, street, city, district, postalCode, isDefault: isDefault ?? false })
    .returning();
  res.status(201).json(formatAddress(address));
});

router.put("/users/me/addresses/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { fullName, phone, street, city, district, postalCode, isDefault } = req.body;
  if (isDefault) {
    await db
      .update(addressesTable)
      .set({ isDefault: false })
      .where(eq(addressesTable.userId, req.userId));
  }
  const [updated] = await db
    .update(addressesTable)
    .set({ fullName, phone, street, city, district, postalCode, isDefault: isDefault ?? false })
    .where(and(eq(addressesTable.id, id), eq(addressesTable.userId, req.userId)))
    .returning();
  res.json(formatAddress(updated));
});

router.delete("/users/me/addresses/:id", requireAuth, async (req: any, res) => {
  const id = parseInt(req.params.id);
  await db
    .delete(addressesTable)
    .where(and(eq(addressesTable.id, id), eq(addressesTable.userId, req.userId)));
  res.json({ message: "Address deleted" });
});

export default router;
