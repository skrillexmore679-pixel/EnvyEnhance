import { Router } from "express";
import { db } from "@workspace/db";
import { cartItemsTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function buildCart(userId: string) {
  const items = await db
    .select({ cart: cartItemsTable, product: productsTable })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.userId, userId));

  let subtotal = 0;
  let discount = 0;

  const mapped = items.map(({ cart, product }) => {
    const price = product.discountPrice != null ? Number(product.discountPrice) : Number(product.price);
    const originalPrice = Number(product.price);
    subtotal += originalPrice * cart.quantity;
    if (product.discountPrice != null) {
      discount += (originalPrice - Number(product.discountPrice)) * cart.quantity;
    }
    return {
      id: cart.id,
      productId: cart.productId,
      quantity: cart.quantity,
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
        averageRating: 0,
        reviewCount: 0,
        isFeatured: product.isFeatured,
        createdAt: product.createdAt.toISOString(),
      },
    };
  });

  return { items: mapped, subtotal, discount, total: subtotal - discount };
}

router.get("/cart", requireAuth, async (req: any, res) => {
  const cart = await buildCart(req.userId);
  res.json(cart);
});

router.post("/cart/items", requireAuth, async (req: any, res) => {
  const { productId, quantity } = req.body;
  const existing = await db
    .select()
    .from(cartItemsTable)
    .where(and(eq(cartItemsTable.userId, req.userId), eq(cartItemsTable.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(cartItemsTable)
      .set({ quantity: existing[0].quantity + quantity, updatedAt: new Date() })
      .where(eq(cartItemsTable.id, existing[0].id));
  } else {
    await db.insert(cartItemsTable).values({ userId: req.userId, productId, quantity });
  }

  const cart = await buildCart(req.userId);
  res.json(cart);
});

router.put("/cart/items/:productId", requireAuth, async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  const { quantity } = req.body;
  await db
    .update(cartItemsTable)
    .set({ quantity, updatedAt: new Date() })
    .where(and(eq(cartItemsTable.userId, req.userId), eq(cartItemsTable.productId, productId)));
  const cart = await buildCart(req.userId);
  res.json(cart);
});

router.delete("/cart/items/:productId", requireAuth, async (req: any, res) => {
  const productId = parseInt(req.params.productId);
  await db
    .delete(cartItemsTable)
    .where(and(eq(cartItemsTable.userId, req.userId), eq(cartItemsTable.productId, productId)));
  const cart = await buildCart(req.userId);
  res.json(cart);
});

router.delete("/cart", requireAuth, async (req: any, res) => {
  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, req.userId));
  res.json({ message: "Cart cleared" });
});

export default router;
