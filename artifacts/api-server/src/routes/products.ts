import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  reviewsTable,
} from "@workspace/db";
import { eq, ilike, gte, lte, and, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

function toProduct(p: typeof productsTable.$inferSelect, avgRating: number, reviewCount: number) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    discountPrice: p.discountPrice != null ? Number(p.discountPrice) : null,
    category: p.category,
    stock: p.stock,
    description: p.description,
    ingredients: p.ingredients,
    keyBenefits: (p.keyBenefits as string[]) ?? [],
    mainIngredients: (p.mainIngredients as { name: string; icon: string }[]) ?? [],
    bestFor: (p.bestFor as string[]) ?? [],
    texture: p.texture ?? null,
    images: p.images as string[],
    averageRating: avgRating,
    reviewCount,
    isFeatured: p.isFeatured,
    homepageSection: p.homepageSection,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products/featured", async (req, res) => {
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.isFeatured, true))
    .limit(8);

  const result = await Promise.all(
    products.map(async (p) => {
      const [stats] = await db
        .select({
          avg: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(reviewsTable)
        .where(eq(reviewsTable.productId, p.id));
      return toProduct(p, Number(Number(stats.avg).toFixed(1)), Number(stats.count));
    }),
  );
  res.json(result);
});

router.get("/products/homepage", async (_req, res) => {
  const [topProducts, bottomProducts] = await Promise.all([
    db.select().from(productsTable).where(eq(productsTable.homepageSection, "top")).orderBy(desc(productsTable.createdAt)),
    db.select().from(productsTable).where(eq(productsTable.homepageSection, "bottom")).orderBy(desc(productsTable.createdAt)),
  ]);

  async function withStats(products: typeof topProducts) {
    return Promise.all(products.map(async (p) => {
      const [stats] = await db.select({
        avg: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
        count: sql<string>`COUNT(*)`,
      }).from(reviewsTable).where(eq(reviewsTable.productId, p.id));
      return toProduct(p, Number(Number(stats.avg).toFixed(1)), Number(stats.count));
    }));
  }

  res.json({
    top: await withStats(topProducts),
    bottom: await withStats(bottomProducts),
  });
});

router.get("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [p] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));
  if (!p) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const [stats] = await db
    .select({
      avg: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.productId, p.id));
  res.json(toProduct(p, Number(Number(stats.avg).toFixed(1)), Number(stats.count)));
});

router.get("/products", async (req, res) => {
  const {
    category,
    search,
    minPrice,
    maxPrice,
    minRating,
    page = "1",
    limit = "20",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (category) conditions.push(eq(productsTable.category, category));
  if (search)
    conditions.push(ilike(productsTable.name, `%${search}%`));
  if (minPrice)
    conditions.push(gte(productsTable.price, minPrice));
  if (maxPrice)
    conditions.push(lte(productsTable.price, maxPrice));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<string>`COUNT(*)` })
    .from(productsTable)
    .where(where);

  const products = await db
    .select()
    .from(productsTable)
    .where(where)
    .orderBy(desc(productsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const result = await Promise.all(
    products.map(async (p) => {
      const [stats] = await db
        .select({
          avg: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(reviewsTable)
        .where(eq(reviewsTable.productId, p.id));
      return toProduct(p, Number(Number(stats.avg).toFixed(1)), Number(stats.count));
    }),
  );

  let filtered = result;
  if (minRating) {
    filtered = result.filter((p) => p.averageRating >= Number(minRating));
  }

  res.json({
    products: filtered,
    total: Number(total),
    page: pageNum,
    totalPages: Math.ceil(Number(total) / limitNum),
  });
});

router.post("/products", requireAdmin, async (req: any, res) => {
  const {
    name, price, discountPrice, category, stock, description,
    ingredients, images, isFeatured, homepageSection,
    keyBenefits, mainIngredients, bestFor, texture,
  } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
  const [p] = await db
    .insert(productsTable)
    .values({
      name, slug,
      price: String(price),
      discountPrice: discountPrice != null ? String(discountPrice) : null,
      category,
      stock: stock ?? 0,
      description,
      ingredients: ingredients ?? null,
      keyBenefits: keyBenefits ?? [],
      mainIngredients: mainIngredients ?? [],
      bestFor: bestFor ?? [],
      texture: texture ?? null,
      images: images ?? [],
      isFeatured: isFeatured ?? false,
      homepageSection: homepageSection || null,
    })
    .returning();
  res.status(201).json(toProduct(p, 0, 0));
});

router.put("/products/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const {
    name, price, discountPrice, category, stock, description,
    ingredients, images, isFeatured, homepageSection,
    keyBenefits, mainIngredients, bestFor, texture,
  } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (price !== undefined) updates.price = String(price);
  if (discountPrice !== undefined) updates.discountPrice = discountPrice != null ? String(discountPrice) : null;
  if (category !== undefined) updates.category = category;
  if (stock !== undefined) updates.stock = stock;
  if (description !== undefined) updates.description = description;
  if (ingredients !== undefined) updates.ingredients = ingredients;
  if (keyBenefits !== undefined) updates.keyBenefits = keyBenefits;
  if (mainIngredients !== undefined) updates.mainIngredients = mainIngredients;
  if (bestFor !== undefined) updates.bestFor = bestFor;
  if (texture !== undefined) updates.texture = texture ?? null;
  if (images !== undefined) updates.images = images;
  if (isFeatured !== undefined) updates.isFeatured = isFeatured;
  if (homepageSection !== undefined) updates.homepageSection = homepageSection || null;
  updates.updatedAt = new Date();

  const [p] = await db
    .update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, id))
    .returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  const [stats] = await db.select({ avg: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`, count: sql<string>`COUNT(*)` }).from(reviewsTable).where(eq(reviewsTable.productId, p.id));
  res.json(toProduct(p, Number(Number(stats.avg).toFixed(1)), Number(stats.count)));
});

router.delete("/products/:id", requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ message: "Product deleted" });
});

export default router;
