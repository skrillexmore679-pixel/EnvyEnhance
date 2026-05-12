import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import cartRouter from "./cart";
import ordersRouter from "./orders";
import reviewsRouter from "./reviews";
import wishlistRouter from "./wishlist";
import couponsRouter from "./coupons";
import usersRouter from "./users";
import adminRouter from "./admin";
import categoriesRouter from "./categories";
import monthlyRecordsRouter from "./monthlyRecords";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(cartRouter);
router.use(ordersRouter);
router.use(reviewsRouter);
router.use(wishlistRouter);
router.use(couponsRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(monthlyRecordsRouter);

export default router;
