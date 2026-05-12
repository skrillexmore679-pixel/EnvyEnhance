import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect, Link } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { GuestCartProvider } from "@/contexts/GuestCartContext";
import { PageProvider, usePageContext } from "@/contexts/PageContext";

import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { FloatingCartIcon } from "./components/ui/FloatingCartIcon";
import { ProfileSync } from "./components/auth/ProfileSync";
import { HomePage } from "./pages/HomePage";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { WishlistPage } from "./pages/WishlistPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TrackOrderPage } from "./pages/TrackOrderPage";
import { AdminPage } from "./pages/AdminPage";
import { useGetMe } from "@workspace/api-client-react";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(20 10% 18%)",
    colorForeground: "hsl(20 10% 18%)",
    colorMutedForeground: "hsl(20 6% 45%)",
    colorDanger: "hsl(0 72% 51%)",
    colorBackground: "hsl(34 23% 98%)",
    colorInput: "hsl(34 23% 98%)",
    colorInputForeground: "hsl(20 10% 18%)",
    colorNeutral: "hsl(30 15% 86%)",
    fontFamily: "'DM Sans', Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-xl w-[440px] max-w-full overflow-hidden border border-border shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent",
    footer: "!shadow-none !border-0 !bg-transparent",
    headerTitle: "font-serif text-2xl font-medium",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "text-foreground font-medium text-sm",
    footerActionLink: "text-accent hover:text-accent/80 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-border hover:bg-muted/50",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
    footerAction: "bg-muted/30 pb-6 pt-4",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive/20 text-destructive",
    otpCodeFieldInput: "border-input bg-background",
    formFieldRow: "mb-4",
    main: "p-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#fdf6f0] to-[#fdf0f2] px-4 py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#fdf6f0] to-[#fdf0f2] px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        // invalidateQueries marks all queries stale and re-fetches active ones,
        // so mounted components (homepage, etc.) immediately reload their data
        // without requiring a manual page refresh.
        queryClient.invalidateQueries();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

// Must be set at module level — before any component renders — so the browser
// never auto-scrolls on popstate before we can intercept it.
if (typeof window !== "undefined") {
  window.history.scrollRestoration = "manual";
}

const SCROLL_KEY = (path: string) => `__scroll__${path}`;

function saveScrollPosition(path: string) {
  try {
    sessionStorage.setItem(SCROLL_KEY(path), String(Math.round(window.scrollY)));
  } catch (_) {}
}

function readScrollPosition(path: string): number {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY(path));
    return v ? parseInt(v, 10) : 0;
  } catch (_) { return 0; }
}

function ScrollManager() {
  const [location] = useLocation();
  // Tracks whether the current navigation was triggered by the browser back/forward buttons
  const isPopStateRef = useRef(false);
  // Tracks the previous path so we can save its scroll before leaving
  const prevPathRef = useRef(location);

  // Listen for popstate BEFORE wouter processes it — this fires first because
  // we add the listener here, and wouter adds its listener on component mount
  // (which happens during the same initial render cycle).
  useEffect(() => {
    const onPopState = () => {
      // Save current page's position right before leaving
      saveScrollPosition(prevPathRef.current);
      isPopStateRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Save scroll position on every scroll event (no debounce — immediate)
  // Also saves on cleanup (when navigating away via a link)
  useEffect(() => {
    const save = () => saveScrollPosition(location);
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      // Flush final position when this route unmounts / location changes
      saveScrollPosition(location);
      window.removeEventListener("scroll", save);
    };
  }, [location]);

  // Handle scroll behaviour on route transitions
  useEffect(() => {
    const targetPath = location;
    prevPathRef.current = targetPath;

    if (isPopStateRef.current) {
      isPopStateRef.current = false;
      const y = readScrollPosition(targetPath);
      // Double rAF: first frame lets React commit the new page's DOM,
      // second frame ensures the browser has painted it so scrollTo works.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
        });
      });
    } else {
      // Regular forward navigation — go to top immediately
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [location]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in"><Component /></Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function AdminRoute() {
  const { data: dbUser, isLoading } = useGetMe({ query: { retry: false, queryKey: ["me"] } });
  if (isLoading) return null;
  if (dbUser?.role !== "admin") return <Redirect to="/" />;
  return <AdminPage />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { pageReady } = usePageContext();
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      {pageReady && <Footer />}
      <FloatingCartIcon />
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your EnvyEnhance account" } },
        signUp: { start: { title: "Join EnvyEnhance", subtitle: "Create your account to start your ritual" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <GuestCartProvider>
          <PageProvider>
            <ClerkQueryClientCacheInvalidator />
            <ProfileSync />
            <ScrollManager />
            <AppLayout>
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/products" component={ProductsPage} />
                <Route path="/products/:id" component={ProductDetailPage} />
                <Route path="/cart" component={CartPage} />
                <Route path="/checkout">
                  {() => <ProtectedRoute component={CheckoutPage} />}
                </Route>
                <Route path="/orders">
                  {() => <ProtectedRoute component={OrdersPage} />}
                </Route>
                <Route path="/orders/:id" component={OrderDetailPage} />
                <Route path="/wishlist">
                  {() => <ProtectedRoute component={WishlistPage} />}
                </Route>
                <Route path="/profile">
                  {() => <ProtectedRoute component={ProfilePage} />}
                </Route>
                <Route path="/track" component={TrackOrderPage} />
                <Route path="/admin">
                  {() => (
                    <>
                      <Show when="signed-in"><AdminRoute /></Show>
                      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
                    </>
                  )}
                </Route>
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/:rest*">
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                    <h1 className="font-serif text-6xl font-medium mb-4 text-muted-foreground/30">404</h1>
                    <h2 className="font-serif text-2xl font-medium mb-2">Page not found</h2>
                    <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist.</p>
                    <Link href="/" className="text-sm text-accent underline underline-offset-4">Return home</Link>
                  </div>
                </Route>
              </Switch>
            </AppLayout>
            <Toaster />
          </PageProvider>
        </GuestCartProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
