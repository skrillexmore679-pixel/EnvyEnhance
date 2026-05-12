import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import {
  ShoppingBag, User as UserIcon, Heart, Menu, Search, LogOut,
  Settings, Package, X, Home, Sparkles, Droplets, Wind, Flower2, Sun, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCart, getGetCartQueryKey, useListCategories, getListCategoriesQueryKey, useGetMe } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useGuestCart } from "@/hooks/useGuestCart";

const defaultCategoryIcons: Record<string, React.ElementType> = {
  moisturizers: Droplets,
  serums: Sparkles,
  sunscreen: Sun,
  masks: Flower2,
  cleansers: Wind,
  toners: Droplets,
  "eye-care": Eye,
  "lip-care": Heart,
};

function getCategoryIcon(slug: string): React.ElementType {
  return defaultCategoryIcons[slug] ?? Sparkles;
}

export function Navbar() {
  const [location, navigate] = useLocation();
  const searchStr = useSearch();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const guestCart = useGuestCart();

  const { data: cart } = useGetCart({
    query: { enabled: !!user, retry: false, queryKey: getGetCartQueryKey() },
  });

  const { data: dbUser } = useGetMe({
    query: { enabled: !!user, retry: false, queryKey: ["me"] },
  });

  const { data: dbCategories } = useListCategories({
    query: { staleTime: 60_000, queryKey: getListCategoriesQueryKey() },
  });

  const serverCartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const cartItemCount = user ? serverCartCount : guestCart.totalCount;

  // Admin if DB role is admin (covers both Clerk metadata and DB-only admin)
  const isAdmin = dbUser?.role === "admin" || user?.publicMetadata?.role === "admin";

  const categories = dbCategories ?? [];

  const activeCategory = new URLSearchParams(searchStr).get("category") ?? "";

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location, searchStr]);

  function handleMobileCategory(slug: string) {
    navigate(`/products?category=${slug}`);
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="EnvyEnhance" className="h-8 w-8 rounded-full object-cover" />
              <span className="font-serif text-xl font-medium tracking-wide">EnvyEnhance</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                href="/products"
                className={`transition-colors hover:text-primary ${location === "/products" && !activeCategory ? "text-primary" : "text-muted-foreground"}`}
              >
                All Products
              </Link>
              {categories.slice(0, 3).map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/products?category=${cat.slug}`}
                  className={`transition-colors hover:text-primary ${activeCategory === cat.slug ? "text-primary" : "text-muted-foreground"}`}
                >
                  {cat.name}
                </Link>
              ))}
              <Link href="/track" className="transition-colors hover:text-primary text-muted-foreground">
                Track Order
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>

            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden sm:block"
              >
                Sign In
              </Link>
            </Show>

            <Show when="signed-in">
              <Link href="/wishlist">
                <Button variant="ghost" size="icon" className="hidden sm:flex">
                  <Heart className="h-5 w-5" />
                  <span className="sr-only">Wishlist</span>
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hidden sm:flex">
                    {user?.imageUrl ? (
                      <img src={user.imageUrl} alt="Profile" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex flex-col space-y-1 leading-none px-2 py-2">
                    <p className="font-medium text-sm">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.emailAddresses[0]?.emailAddress}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer flex items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer flex items-center">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/orders" className="cursor-pointer flex items-center">
                      <Package className="mr-2 h-4 w-4" />
                      Orders
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => signOut()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Show>

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingBag className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full bg-accent text-accent-foreground text-xs">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </Badge>
                )}
                <span className="sr-only">Cart</span>
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile Drawer */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-background shadow-2xl transform transition-transform duration-300 ease-out md:hidden flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b shrink-0">
          <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="EnvyEnhance" className="h-7 w-7 rounded-full object-cover" />
            <span className="font-serif text-lg font-medium">EnvyEnhance</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              location === "/" ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Home className="h-4 w-4 shrink-0" />
            Home
          </Link>

          <Link
            href="/products"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              location === "/products" && !activeCategory
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            Shop All
          </Link>

          <p className="text-xs uppercase tracking-widest text-muted-foreground/60 px-4 pt-4 pb-1 font-medium">
            Categories
          </p>

          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.slug);
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => handleMobileCategory(cat.slug)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {cat.name}
              </button>
            );
          })}

          <p className="text-xs uppercase tracking-widest text-muted-foreground/60 px-4 pt-4 pb-1 font-medium">
            More
          </p>

          <Link
            href="/track"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              location === "/track"
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4 shrink-0" />
            Track Order
          </Link>
        </nav>

        <div className="px-4 py-5 border-t shrink-0 space-y-2">
          <Show when="signed-out">
            <Link href="/sign-in">
              <Button className="w-full rounded-xl" size="sm">Sign In</Button>
            </Link>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-3 px-2 mb-3">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Profile" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-accent" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.emailAddresses[0]?.emailAddress}</p>
              </div>
            </div>
            <Link href="/profile">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm rounded-xl" size="sm">
                <UserIcon className="h-4 w-4" /> Profile
              </Button>
            </Link>
            <Link href="/orders">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm rounded-xl" size="sm">
                <Package className="h-4 w-4" /> My Orders
              </Button>
            </Link>
            <Link href="/wishlist">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm rounded-xl" size="sm">
                <Heart className="h-4 w-4" /> Wishlist
              </Button>
            </Link>
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" className="w-full justify-start gap-2 text-sm rounded-xl" size="sm">
                  <Settings className="h-4 w-4" /> Admin Dashboard
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm text-destructive hover:text-destructive rounded-xl"
              size="sm"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </Show>
        </div>
      </div>
    </>
  );
}
