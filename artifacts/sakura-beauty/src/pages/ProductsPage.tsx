import { useState, useEffect } from "react";
import { useListProducts, useListCategories, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useLocation, useSearch } from "wouter";

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [minRating, setMinRating] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const activeCategory = new URLSearchParams(searchStr).get("category") ?? "";

  const { data: dbCategories } = useListCategories({
    query: { staleTime: 60_000, queryKey: getListCategoriesQueryKey() },
  });

  useEffect(() => {
    setPage(1);
    setSearch("");
  }, [activeCategory]);

  function handleCategoryChange(cat: string) {
    if (cat) {
      navigate(`/products?category=${cat}`);
    } else {
      navigate("/products");
    }
    setPage(1);
  }

  function handleClearCategory() {
    navigate("/products");
    setPage(1);
  }

  const { data, isLoading } = useListProducts({
    category: activeCategory || undefined,
    search: search || undefined,
    minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
    maxPrice: priceRange[1] < 10000 ? priceRange[1] : undefined,
    minRating: minRating > 0 ? minRating : undefined,
    page,
    limit: 16,
  });

  const products = data?.products ?? [];
  const totalPages = data?.totalPages ?? 1;

  // Resolve active category name from DB
  const activeCategoryObj = dbCategories?.find((c) => c.slug === activeCategory);
  const displayTitle = activeCategoryObj?.name
    ?? (activeCategory ? activeCategory.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Shop All");

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-muted/30 border-b py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-accent mb-2 font-medium">
                {activeCategory ? (activeCategoryObj?.name ?? activeCategory) : "All products"}
              </p>
              <h1 className="font-serif text-4xl font-medium">{displayTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-10 rounded-full"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {activeCategory && (
              <Badge variant="secondary" className="gap-1">
                {activeCategoryObj?.name ?? activeCategory}
                <button onClick={handleClearCategory}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {minRating > 0 && (
              <Badge variant="secondary" className="gap-1">
                {minRating}+ stars
                <button onClick={() => setMinRating(0)}><X className="h-3 w-3" /></button>
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {showFilters && (
            <aside className="hidden md:block w-64 shrink-0">
              <div className="bg-card border rounded-xl p-5 sticky top-24 space-y-6">
                <div>
                  <h3 className="font-medium text-sm mb-3 uppercase tracking-wider">Category</h3>
                  <div className="space-y-1">
                    <button
                      onClick={() => handleCategoryChange("")}
                      className={`block w-full text-left text-sm py-1.5 px-3 rounded-lg transition-colors ${activeCategory === "" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                    >
                      All
                    </button>
                    {(dbCategories ?? []).map((cat) => (
                      <button
                        key={cat.slug}
                        onClick={() => handleCategoryChange(cat.slug)}
                        className={`block w-full text-left text-sm py-1.5 px-3 rounded-lg transition-colors ${activeCategory === cat.slug ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                      >
                        {(cat as any).icon && <span className="mr-1.5">{(cat as any).icon}</span>}
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-sm mb-3 uppercase tracking-wider">Price Range</h3>
                  <Slider
                    min={0}
                    max={10000}
                    step={100}
                    value={priceRange}
                    onValueChange={(v) => { setPriceRange(v); setPage(1); }}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>৳{priceRange[0].toLocaleString()}</span>
                    <span>৳{priceRange[1].toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-sm mb-3 uppercase tracking-wider">Min Rating</h3>
                  <div className="flex gap-2">
                    {[0, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        onClick={() => { setMinRating(r); setPage(1); }}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${minRating === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground"}`}
                      >
                        {r === 0 ? "Any" : `${r}+`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          )}

          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
                    <Skeleton className="aspect-square w-full" />
                    <div className="p-4 flex flex-col gap-2">
                      <Skeleton className="h-2.5 w-14 rounded-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                      <div className="flex gap-0.5 mt-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Skeleton key={j} className="h-3 w-3 rounded-sm" />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-8 w-full rounded-xl mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-muted-foreground text-lg mb-2">No products found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-6">{data?.total ?? 0} products</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} backContext={activeCategory || undefined} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-10">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-9 w-9 rounded-full text-sm transition-colors ${page === p ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-foreground"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
