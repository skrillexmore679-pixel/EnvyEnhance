import { Router } from "express";
import { db } from "@workspace/db";
import { wishlistTable, productsTable, reviewsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/wishlist", requireAuth, async (req: any, res) => {
  const items = await db
    .select({ wishlist: wishlistTable, product: productsTable })
    .from(wishlistTable)
    .innerJoin(productsTable, eq(wishlistTable.productId, productsTable.id))
    .where(eq(wishlistTable.userId, req.userId));

  const result = await Promise.all(
    items.map(async ({ wishlist, product }) => {
      const [stats] = await db
        .select({
          avg: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
          count: sql<string>`COUNT(*)`,
        })
        .from(reviewsTable)
        .where(eq(reviewsTable.productId, product.id));
      return {
        id: wishlist.id,
        productId: wishlist.productId,
        addedAt: wishlist.addedAt.toISOString(),
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: Number(product.price),
          discountPrice: product.discountPrice != null ? Number(product.discountPrice) : null,
          category: product.category,
          stock: product.stock,
          description: product.description,
          ingredients: product.ingredients,
          images: product.images as string[],
          averageRating: Number(Number(stats.avg).toFixed(1)),
          reviewCount: Number(stats.count),
          isFeatured: product.isFeatured,
          createdAt: product.createdAt.toISOString(),
        },
      };
    })
  );
  res.json(result);
});

router.post("/wishlist/:productId", requireAuth, async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  try {
    await db.insert(wishlistTable).values({ userId: req.userId, productId });
  } catch {}
  res.json({ message: "Added to wishlist" });
});

router.delete("/wishlist/:productId", requireAuth, async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  await db
    .delete(wishlistTable)
    .where(and(eq(wishlistTable.userId, req.userId), eq(wishlistTable.productId, productId)));
  res.json({ message: "Removed from wishlist" });
});

export default router;
