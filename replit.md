# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## EnvyEnhance — Japanese Luxury E-Commerce

### Architecture

- **Frontend**: React + Vite + Tailwind CSS v4 (`@workspace/sakura-beauty`, served at `/`)
- **API**: Express + Drizzle ORM (`@workspace/api-server`, served at `/api`)
- **Auth**: Clerk (managed integration, auto-provisioned keys)
- **Database**: PostgreSQL (Drizzle ORM schema in `lib/db/src/schema/`)
- **API Client**: Orval-generated React Query hooks in `lib/api-client-react/`
- **API Spec**: OpenAPI 3.0 in `lib/api-spec/openapi.yaml`

### Workflows

- `API Server` — `PORT=8080 pnpm --filter @workspace/api-server run dev`
- `Sakura Beauty` — `PORT=22027 BASE_PATH=/ pnpm --filter @workspace/sakura-beauty run dev`

### Pages

- `/` — Home (hero, featured products, category banners, brand story)
- `/products` — Products grid (search, filter by category/price/rating)
- `/products/:id` — Product detail (images, reviews, add to cart/wishlist)
- `/cart` — Shopping cart with quantity management
- `/checkout` — Checkout with bKash/Nagad/COD payment, coupon support
- `/orders` — Order list
- `/orders/:id` — Order detail with tracking progress
- `/wishlist` — Saved items
- `/profile` — User profile with Clerk UserProfile component
- `/track` — Public order tracking by code
- `/admin` — Admin panel (products, orders, users management)
- `/sign-in`, `/sign-up` — Clerk auth pages

### Features

- Clerk auth with Google/social login
- Product search + filtering (category, price range, rating)
- **Guest cart**: unauthenticated users can add to cart (localStorage); syncs to server on login via `ProfileSync.tsx`
- Cart with quantity updates
- bKash/Nagad/COD payment simulation
- Coupon code validation (WELCOME20, SAKURA500)
- Order tracking with visual progress steps
- Wishlist with heart toggle on product cards
- Admin panel: create/edit/delete products, update order status, view users
  - Orders tab: customer name/email, expandable rows, 30s polling, search; **status dropdown disabled for delivered orders**
  - Users tab: order count badge (click → jump to their orders), block/unblock, user search
  - **Coupons tab**: full CRUD UI — create, edit, delete, toggle active/inactive; direct fetch with admin token
  - **Monthly History tab**: shows archived monthly stats (revenue + orders per month); auto-archives on 1st of month via server scheduler; manual "Archive Last Month" button
  - **Archived Orders tab**: includes Products column (product name × qty)
  - **Dashboard**: Revenue and Orders stats show **current month only** (resets on 1st), counts **delivered orders only** for revenue
- **Stock deduction on delivery**: when admin marks order as "delivered", product stock is auto-decremented for each item; idempotent (only runs on status transition, not if already delivered); delivered status is then locked (dropdown disabled)
- **Guest cart float icon**: clicking the floating cart icon now navigates guests to `/cart` (previously went to `/sign-in`)
- **Orders page**: each order card shows the tracking ID with a clipboard copy button
- Checkout: saved addresses picker (auto-fills shipping form)
- Order detail: "Continue Shopping" button
- **Email notifications** (Resend): order confirmation on purchase, order status update when admin changes status
  - Service: `artifacts/api-server/src/lib/email.ts`
  - Gracefully skips if `RESEND_API_KEY` env var is not set
  - **NOTE**: Resend integration was dismissed. To activate emails, either: (a) connect via Replit integrations (Resend connector ID: `ccfg_resend_01K69QKYK789WN202XSE3QS17V`), or (b) provide a `RESEND_API_KEY` secret manually. Also set `APP_URL` secret to your production domain.
- **Better skeleton loading**: ProductCard skeleton mirrors real card structure across HomePage, ProductsPage, and ProductDetailPage
- 10 seeded products (skincare, haircare, bodycare) + 2 coupon codes

### Key Hooks

- `useGuestCart` — `artifacts/sakura-beauty/src/hooks/useGuestCart.ts`; exports `clearGuestCart()` / `getGuestCartItems()` helpers

### Key File Locations

- `artifacts/sakura-beauty/src/pages/` — All page components
- `artifacts/sakura-beauty/src/components/layout/` — Navbar, Footer
- `artifacts/sakura-beauty/src/components/ui/ProductCard.tsx` — Product card
- `artifacts/api-server/src/routes/` — All API route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth, requireAdmin
- `lib/db/src/schema/` — Database schema (users, products, orders, cart, wishlist, coupons, reviews, addresses, monthlyRecords)
- `artifacts/api-server/src/routes/monthlyRecords.ts` — Monthly archiving route + `archiveLastMonth()` function
- `lib/api-spec/openapi.yaml` — Full OpenAPI spec
- `scripts/src/seed.ts` — Database seed (run: `pnpm --filter @workspace/scripts run seed`)

### Color Palette (CSS vars in `index.css`)

- Background: warm ivory `hsl(34 23% 98%)`
- Accent: gold `hsl(43 62% 42%)` (#d4af37 equivalent)
- Primary: deep charcoal `hsl(20 10% 18%)`
- Secondary: warm rose `hsl(350 30% 94%)`
- Fonts: DM Sans (body), DM Serif Display (headings)
