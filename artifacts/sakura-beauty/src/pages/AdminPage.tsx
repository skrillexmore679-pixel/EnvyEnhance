import { useState, useMemo, Fragment, useEffect, useCallback } from "react";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  getGetFeaturedProductsQueryKey, getGetHomepageProductsQueryKey,
  useListAllOrders, useUpdateOrderStatus,
  useListAllUsers, useToggleUserBlock,
  useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useListAllReviews, useDeleteReview,
  getListProductsQueryKey, getListAllOrdersQueryKey, getListCategoriesQueryKey, getListAllUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  LayoutDashboard, Package2, ShoppingCart, Users, Tag, Settings,
  Plus, Pencil, Trash2, Search, TrendingUp, DollarSign, Star,
  ChevronRight, X, Menu, BarChart3, CheckCircle2, Clock, Truck,
  AlertCircle, XCircle, Layers, MessageSquare, MapPin, Ban, UserCheck, ChevronDown, Archive,
  Calendar, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Status helpers ─────────────────────────────────────────────────────────
const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  pending:    { color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  confirmed:  { color: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle2 },
  processing: { color: "bg-violet-100 text-violet-700 border-violet-200", icon: BarChart3 },
  shipped:    { color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: Truck },
  delivered:  { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelled:  { color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

// ─── Sidebar nav items ───────────────────────────────────────────────────────
const navItems = [
  { id: "dashboard",  label: "Dashboard",       icon: LayoutDashboard },
  { id: "products",   label: "Products",        icon: Package2 },
  { id: "categories", label: "Categories",      icon: Layers },
  { id: "orders",     label: "Orders",          icon: ShoppingCart },
  { id: "archived",   label: "Archived Orders", icon: Archive },
  { id: "users",      label: "Users",           icon: Users },
  { id: "reviews",    label: "Reviews",         icon: MessageSquare },
  { id: "coupons",    label: "Coupons",         icon: Tag },
  { id: "monthly",    label: "Monthly History", icon: Calendar },
  { id: "settings",   label: "Settings",        icon: Settings },
];

// ─── Product form ────────────────────────────────────────────────────────────
function ProductModal({ product, categories, onClose }: { product?: any; categories: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [form, setForm] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    category: product?.category ?? (categories[0]?.slug ?? "moisturizers"),
    price: product?.price ?? "",
    discountPrice: product?.discountPrice ?? "",
    stock: product?.stock ?? "",
    images: product?.images?.join(", ") ?? "",
    ingredients: product?.ingredients ?? "",
    keyBenefits: (product?.keyBenefits ?? []).join("\n"),
    mainIngredients: (product?.mainIngredients ?? []) as { name: string; icon: string }[],
    bestFor: (product?.bestFor ?? []).join("\n"),
    texture: product?.texture ?? "",
    isFeatured: product?.isFeatured ?? false,
    homepageSection: product?.homepageSection ?? "",
  });

  const [newIngName, setNewIngName] = useState("");
  const [newIngIcon, setNewIngIcon] = useState("");

  function addMainIngredient() {
    if (!newIngName.trim()) return;
    setForm(f => ({ ...f, mainIngredients: [...f.mainIngredients, { name: newIngName.trim(), icon: newIngIcon.trim() || "🌿" }] }));
    setNewIngName("");
    setNewIngIcon("");
  }

  function removeMainIngredient(idx: number) {
    setForm(f => ({ ...f, mainIngredients: f.mainIngredients.filter((_, i) => i !== idx) }));
  }

  function updateMainIngredient(idx: number, field: "name" | "icon", value: string) {
    setForm(f => ({
      ...f,
      mainIngredients: f.mainIngredients.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-"),
      description: form.description,
      category: form.category,
      ingredients: form.ingredients || undefined,
      keyBenefits: form.keyBenefits.split("\n").map((s: string) => s.trim()).filter(Boolean),
      mainIngredients: form.mainIngredients,
      bestFor: form.bestFor.split("\n").map((s: string) => s.trim()).filter(Boolean),
      texture: form.texture || null,
      isFeatured: form.isFeatured,
      homepageSection: form.homepageSection || null,
      price: parseFloat(String(form.price)),
      discountPrice: form.discountPrice ? parseFloat(String(form.discountPrice)) : undefined,
      stock: parseInt(String(form.stock)),
      images: String(form.images).split(",").map((s) => s.trim()).filter(Boolean),
    };
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFeaturedProductsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetHomepageProductsQueryKey() });
      onClose();
    };
    if (product) {
      updateProduct.mutate({ id: product.id, data }, { onSuccess: invalidateAll });
    } else {
      createProduct.mutate({ data }, { onSuccess: invalidateAll });
    }
  }

  const catOptions = categories.length > 0
    ? categories
    : [
        { slug: "moisturizers", name: "Moisturizers" },
        { slug: "serums",       name: "Serums" },
        { slug: "sunscreen",    name: "Sunscreen" },
        { slug: "face-masks",   name: "Face Masks" },
        { slug: "cleansers",    name: "Cleansers" },
        { slug: "toners",       name: "Toners" },
        { slug: "eye-care",     name: "Eye Care" },
        { slug: "lip-care",     name: "Lip Care" },
        { slug: "hair-care",    name: "Hair Care" },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-semibold text-lg">{product ? "Edit Product" : "Add New Product"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Product Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="mt-1.5 rounded-xl" placeholder="e.g. Hada Labo Gokujyun Premium Milk" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Category *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catOptions.map((c: any) => (
                    <SelectItem key={c.slug} value={c.slug} className="capitalize">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Homepage Section</Label>
              <Select value={form.homepageSection || "none"} onValueChange={v => setForm(f => ({ ...f, homepageSection: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue placeholder="Not on homepage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not on homepage</SelectItem>
                  <SelectItem value="top">Top Section</SelectItem>
                  <SelectItem value="bottom">Below Section</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={e => setForm(f => ({ ...f, isFeatured: e.target.checked }))}
                  className="w-4 h-4 accent-pink-500"
                />
                <span className="text-sm font-medium">Mark as Featured</span>
              </label>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Price (৳) *</Label>
              <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required className="mt-1.5 rounded-xl" placeholder="1500" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Sale Price (৳)</Label>
              <Input type="number" value={form.discountPrice} onChange={e => setForm(f => ({ ...f, discountPrice: e.target.value }))} className="mt-1.5 rounded-xl" placeholder="Optional" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Stock *</Label>
              <Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required className="mt-1.5 rounded-xl" placeholder="50" />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1.5 rounded-xl" rows={3} placeholder="Product description..." />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Key Benefits (one per line)</Label>
            <Textarea
              value={form.keyBenefits}
              onChange={e => setForm(f => ({ ...f, keyBenefits: e.target.value }))}
              className="mt-1.5 rounded-xl"
              rows={4}
              placeholder={"Intense long-lasting hydration\nStrengthens moisture barrier\nMakes skin plump and smooth"}
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Main Ingredients (with icons)</Label>
            <div className="mt-2 space-y-2">
              {form.mainIngredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={ing.icon}
                    onChange={e => updateMainIngredient(idx, "icon", e.target.value)}
                    className="w-16 rounded-xl text-center text-lg"
                    placeholder="🌿"
                  />
                  <Input
                    value={ing.name}
                    onChange={e => updateMainIngredient(idx, "name", e.target.value)}
                    className="flex-1 rounded-xl"
                    placeholder="Ingredient name"
                  />
                  <button
                    type="button"
                    onClick={() => removeMainIngredient(idx)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newIngIcon}
                  onChange={e => setNewIngIcon(e.target.value)}
                  className="w-16 rounded-xl text-center text-lg"
                  placeholder="🌿"
                />
                <Input
                  value={newIngName}
                  onChange={e => setNewIngName(e.target.value)}
                  className="flex-1 rounded-xl"
                  placeholder="Add ingredient..."
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addMainIngredient(); } }}
                />
                <button
                  type="button"
                  onClick={addMainIngredient}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-pink-500 hover:bg-pink-50 transition-colors shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Best For (one per line)</Label>
            <Textarea
              value={form.bestFor}
              onChange={e => setForm(f => ({ ...f, bestFor: e.target.value }))}
              className="mt-1.5 rounded-xl"
              rows={3}
              placeholder={"Dry skin\nDehydrated skin\nSensitive skin"}
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Texture</Label>
            <Input
              value={form.texture}
              onChange={e => setForm(f => ({ ...f, texture: e.target.value }))}
              className="mt-1.5 rounded-xl"
              placeholder="e.g. Rich milky emulsion with non-greasy finish."
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Image URLs (comma-separated)</Label>
            <Input value={form.images} onChange={e => setForm(f => ({ ...f, images: e.target.value }))} className="mt-1.5 rounded-xl" placeholder="https://..." />
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Full Ingredients (INCI)</Label>
            <Textarea value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} className="mt-1.5 rounded-xl" rows={2} placeholder="INCI names..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="flex-1 rounded-xl bg-pink-500 hover:bg-pink-600 text-white">
              {product ? "Update Product" : "Create Product"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Category form ────────────────────────────────────────────────────────────
function CategoryModal({ category, onClose }: { category?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [form, setForm] = useState({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    icon: category?.icon ?? "",
    displayOrder: category?.displayOrder ?? 0,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      icon: form.icon || null,
      displayOrder: Number(form.displayOrder),
    };
    if (category) {
      updateCategory.mutate({ id: category.id, data }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); onClose(); },
      });
    } else {
      createCategory.mutate({ data }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); onClose(); },
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-lg">{category ? "Edit Category" : "Add Category"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Category Name *</Label>
            <Input
              value={form.name}
              onChange={e => {
                const name = e.target.value;
                setForm(f => ({
                  ...f,
                  name,
                  slug: f.slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                }));
              }}
              required
              className="mt-1.5 rounded-xl"
              placeholder="e.g. Fragrance"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Slug (auto-generated)</Label>
            <Input
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              className="mt-1.5 rounded-xl font-mono text-sm"
              placeholder="fragrance"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Icon (emoji, optional)</Label>
            <Input
              value={form.icon}
              onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              className="mt-1.5 rounded-xl"
              placeholder="🌸"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Display Order</Label>
            <Input
              type="number"
              value={form.displayOrder}
              onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
              className="mt-1.5 rounded-xl"
              placeholder="0"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending} className="flex-1 rounded-xl bg-pink-500 hover:bg-pink-600 text-white">
              {category ? "Update Category" : "Add Category"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main AdminPage ──────────────────────────────────────────────────────────
export function AdminPage() {
  const qc = useQueryClient();
  const { data: productsData, isLoading: productsLoading } = useListProducts({});
  const { data: orders = [], isLoading: ordersLoading } = useListAllOrders({}, { query: { refetchInterval: 30_000, queryKey: getListAllOrdersQueryKey() } });
  const { data: users } = useListAllUsers({ query: { refetchInterval: 30_000, queryKey: getListAllUsersQueryKey() } });
  const { data: me } = useGetMe();
  const { getToken } = useAuth();
  const { data: categories = [] } = useListCategories({ query: { staleTime: 30_000, queryKey: getListCategoriesQueryKey() } });
  const { data: allReviews = [], isLoading: reviewsLoading } = useListAllReviews();

  const deleteProduct = useDeleteProduct();
  const deleteCategory = useDeleteCategory();
  const updateOrderStatus = useUpdateOrderStatus();
  const deleteReview = useDeleteReview();
  const toggleUserBlock = useToggleUserBlock();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [search, setSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [seedingCategories, setSeedingCategories] = useState(false);

  // Coupons state
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponSaving, setCouponSaving] = useState(false);

  // Monthly history state
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // Cancellation reason modal state
  const [cancelModal, setCancelModal] = useState<{ orderId: number; reason: string } | null>(null);

  // Fetch coupons when tab is active
  const fetchCoupons = useCallback(async () => {
    setCouponsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/coupons", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch {
      setCoupons([]);
    } finally {
      setCouponsLoading(false);
    }
  }, [getToken]);

  // Fetch monthly records when tab is active
  const fetchMonthlyRecords = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/monthly-records", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMonthlyRecords(Array.isArray(data) ? data : []);
    } catch {
      setMonthlyRecords([]);
    } finally {
      setMonthlyLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (activeTab === "coupons") fetchCoupons();
  }, [activeTab, fetchCoupons]);

  useEffect(() => {
    if (activeTab === "monthly") fetchMonthlyRecords();
  }, [activeTab, fetchMonthlyRecords]);

  // Coupon CRUD handlers
  async function handleSaveCoupon(form: any) {
    setCouponSaving(true);
    try {
      const token = await getToken();
      const url = editingCoupon ? `/api/coupons/${editingCoupon.id}` : "/api/coupons";
      const method = editingCoupon ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      setShowCouponModal(false);
      setEditingCoupon(null);
      fetchCoupons();
    } finally {
      setCouponSaving(false);
    }
  }

  async function handleDeleteCoupon(id: number) {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    const token = await getToken();
    await fetch(`/api/coupons/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchCoupons();
  }

  async function handleToggleCoupon(id: number) {
    const token = await getToken();
    await fetch(`/api/coupons/${id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchCoupons();
  }

  async function handleArchiveNow() {
    if (!confirm("Archive last month's data now? This will save last month's stats to Monthly History.")) return;
    const token = await getToken();
    const res = await fetch("/api/admin/monthly-records/archive", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    alert(result.message);
    fetchMonthlyRecords();
  }

  const products = productsData?.products ?? [];

  const filteredProducts = useMemo(
    () => products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    ),
    [products, search]
  );

  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const archivedOrders = useMemo(
    () => orders.filter(o =>
      o.orderStatus === "delivered" &&
      Date.now() - new Date(o.updatedAt).getTime() > TWO_DAYS
    ),
    [orders]
  );

  const filteredOrders = useMemo(
    () => orders.filter(o => {
      const isArchived = o.orderStatus === "delivered" && Date.now() - new Date(o.updatedAt).getTime() > TWO_DAYS;
      if (isArchived) return false;
      return !orderSearch ||
        String(o.id).includes(orderSearch) ||
        o.orderStatus.toLowerCase().includes(orderSearch.toLowerCase()) ||
        ((o as any).userName ?? "").toLowerCase().includes(orderSearch.toLowerCase()) ||
        ((o as any).userEmail ?? "").toLowerCase().includes(orderSearch.toLowerCase());
    }),
    [orders, orderSearch]
  );

  function handleDeleteProduct(id: number) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    deleteProduct.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProductsQueryKey() }) });
  }

  function handleDeleteCategory(id: number) {
    if (!confirm("Delete this category? This cannot be undone.")) return;
    deleteCategory.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() }) });
  }

  function handleDeleteReview(productId: number, reviewId: number) {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    deleteReview.mutate({ productId, reviewId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["listAllReviews"] }),
    });
  }

  function handleOrderStatus(orderId: number, status: string) {
    if (status === "cancelled") {
      setCancelModal({ orderId, reason: "" });
      return;
    }
    updateOrderStatus.mutate({ id: orderId, data: { orderStatus: status } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAllOrdersQueryKey() }),
    });
  }

  function confirmCancellation() {
    if (!cancelModal) return;
    updateOrderStatus.mutate(
      { id: cancelModal.orderId, data: { orderStatus: "cancelled", cancellationReason: cancelModal.reason.trim() || null } },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAllOrdersQueryKey() }); setCancelModal(null); } }
    );
  }

  function handleToggleBlock(userId: number, isBlocked: boolean) {
    toggleUserBlock.mutate({ id: userId, data: { isBlocked } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAllUsersQueryKey() }),
    });
  }

  async function handleSeedCategories() {
    setSeedingCategories(true);
    try {
      const token = await getToken();
      await fetch("/api/categories/seed", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    } finally {
      setSeedingCategories(false);
    }
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthOrders = orders.filter(o => new Date(o.createdAt) >= startOfMonth);
  const totalRevenue = currentMonthOrders.filter(o => o.orderStatus === "delivered").reduce((s, o) => s + o.totalAmount, 0);
  const totalOrdersThisMonth = currentMonthOrders.length;
  const pendingOrders = orders.filter(o => o.orderStatus === "pending").length;
  const deliveredOrders = orders.filter(o => o.orderStatus === "delivered").length;

  // ─── Sidebar ───────────────────────────────────────────────────────────────
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={`${mobile ? "w-64" : "w-64"} bg-white border-r flex flex-col h-full`}>
      <div className="px-6 py-5 border-b">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">EE</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">EnvyEnhance</p>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === id
                ? "bg-pink-50 text-pink-600"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
            {id === "orders" && pendingOrders > 0 && (
              <span className="ml-auto bg-pink-100 text-pink-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingOrders}
              </span>
            )}
            {id === "archived" && archivedOrders.length > 0 && (
              <span className="ml-auto bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                {archivedOrders.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {(me as any)?.firstName?.[0] ?? "A"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{(me as any)?.firstName} {(me as any)?.lastName}</p>
            <p className="text-xs text-gray-400">Administrator</p>
          </div>
        </div>
      </div>
    </aside>
  );

  // ─── Dashboard Tab ─────────────────────────────────────────────────────────
  const DashboardTab = () => {
    const dashLoading = productsLoading || ordersLoading;
    if (dashLoading) {
      return (
        <div className="space-y-6">
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-xl" />
                </div>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-32 rounded-full" />
              </div>
            ))}
          </div>
          {/* Recent orders + chart skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border p-5">
              <Skeleton className="h-5 w-40 mb-5" />
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Category breakdown skeleton */}
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-pink-50 rounded-xl p-4 text-center space-y-2">
                  <Skeleton className="h-8 w-10 mx-auto" />
                  <Skeleton className="h-3 w-16 mx-auto rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Revenue (This Month)",
            value: totalRevenue > 0 ? `৳${(totalRevenue / 1000).toFixed(1)}k` : "—",
            change: totalRevenue > 0 ? "from delivered orders" : "No delivered orders yet",
            icon: DollarSign,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Orders (This Month)",
            value: totalOrdersThisMonth > 0 ? totalOrdersThisMonth : "—",
            change: totalOrdersThisMonth > 0 ? `${pendingOrders} pending` : "No orders yet",
            icon: ShoppingCart,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Products",
            value: products.length > 0 ? products.length : "—",
            change: products.length > 0 ? `${products.filter(p => p.stock < 10).length} low stock` : "No products yet",
            icon: Package2,
            color: "bg-violet-50 text-violet-600",
          },
          {
            label: "Customers",
            value: users && users.length > 0 ? users.length : "—",
            change: deliveredOrders > 0 ? `${deliveredOrders} delivered` : "No deliveries yet",
            icon: Users,
            color: "bg-pink-50 text-pink-600",
          },
        ].map(({ label, value, change, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
              <div className={`h-9 w-9 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{change}</p>
          </div>
        ))}
      </div>

      {orders.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-800">Recent Orders</h3>
              <button onClick={() => setActiveTab("orders")} className="text-xs text-pink-500 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y">
              {orders.slice(0, 5).map((o) => {
                const cfg = statusConfig[o.orderStatus] ?? { color: "bg-gray-100 text-gray-600", icon: AlertCircle };
                const StatusIcon = cfg.icon;
                return (
                  <div key={o.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 border flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gray-500">#{o.id}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">Order #{o.id}</p>
                      <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" />{o.orderStatus}
                    </span>
                    <span className="text-sm font-semibold text-gray-800 shrink-0">৳{o.totalAmount.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Order Status Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(
                orders.reduce((acc, o) => {
                  acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count]) => (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 capitalize">{status}</span>
                    <span className="text-xs font-semibold text-gray-800">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400 transition-all"
                      style={{ width: `${(count / orders.length) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-semibold text-gray-500 mb-1">No orders yet</p>
          <p className="text-sm text-gray-400">Orders will appear here once customers start purchasing.</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Products by Category</h3>
            <button onClick={() => setActiveTab("products")} className="text-xs text-pink-500 hover:underline flex items-center gap-1">
              Manage <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(
              products.reduce((acc, p) => {
                acc[p.category] = (acc[p.category] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([cat, count]) => (
              <div key={cat} className="bg-pink-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-pink-600">{count}</p>
                <p className="text-xs text-gray-500 capitalize mt-1">{cat}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    );
  };

  // ─── Products Tab ──────────────────────────────────────────────────────────
  const ProductsTab = () => (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button onClick={() => setShowProductModal(true)} className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> Add Product
        </Button>
      </div>

      {productsLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Homepage</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-pink-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="h-10 w-10 rounded-xl object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-gray-100 border" />
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{p.name}</p>
                          {p.isFeatured && (
                            <span className="text-xs bg-pink-50 text-pink-500 border border-pink-200 px-1.5 py-0.5 rounded-md font-medium">Featured</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="capitalize text-gray-500 text-xs bg-gray-100 px-2.5 py-1 rounded-full font-medium">{p.category}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {(p as any).homepageSection ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                          (p as any).homepageSection === "top"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-blue-50 text-blue-600 border border-blue-200"
                        }`}>
                          {(p as any).homepageSection === "top" ? "Top Section" : "Below Section"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <p className="font-semibold text-gray-800">৳{p.price.toLocaleString()}</p>
                      {p.discountPrice && <p className="text-xs text-pink-500">Sale: ৳{p.discountPrice.toLocaleString()}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-semibold ${p.stock < 10 ? "text-red-500" : "text-gray-700"}`}>{p.stock}</span>
                      {p.stock < 10 && <p className="text-xs text-red-400">Low stock</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditingProduct(p); setShowProductModal(true); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-12">No products found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Categories Tab ─────────────────────────────────────────────────────────
  const CategoriesTab = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">Manage your product categories. They auto-appear in the hamburger menu and filters.</p>
        </div>
        <div className="flex gap-2">
          {(categories as any[]).length === 0 && (
            <Button
              variant="outline"
              onClick={handleSeedCategories}
              disabled={seedingCategories}
              className="rounded-xl text-sm shrink-0"
            >
              {seedingCategories ? "Loading..." : "Load Defaults"}
            </Button>
          )}
          <Button onClick={() => setShowCategoryModal(true)} className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Add Category
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <Layers className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-semibold text-gray-500 mb-1">No categories yet</p>
          <p className="text-sm text-gray-400 mb-4">Add your first category to organize products and update the navigation menu.</p>
          <Button onClick={() => setShowCategoryModal(true)} className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Add First Category
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Slug</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Icon</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.map((cat) => {
                  const productCount = products.filter(p => p.category === cat.slug).length;
                  return (
                    <tr key={cat.id} className="hover:bg-pink-50/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-800">{cat.name}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{cat.slug}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xl">{cat.icon ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-500">{cat.displayOrder}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-semibold text-gray-700">{productCount}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Orders Tab ────────────────────────────────────────────────────────────
  const OrdersTab = () => (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by order ID, customer, or status..."
            value={orderSearch}
            onChange={e => setOrderSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          {["all","pending","delivered"].map(s => (
            <button
              key={s}
              onClick={() => setOrderSearch(s === "all" ? "" : s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                (s === "all" && !orderSearch) || orderSearch === s
                  ? "bg-pink-100 text-pink-600"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {ordersLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOrders.map((o) => {
                  const cfg = statusConfig[o.orderStatus] ?? { color: "bg-gray-100 text-gray-600 border-gray-200", icon: AlertCircle };
                  const StatusIcon = cfg.icon;
                  const isExpanded = expandedOrderId === o.id;
                  const addr = (o as any).shippingAddress as { fullName?: string; street?: string; line1?: string; city?: string; district?: string; phone?: string } | null;
                  return (
                    <Fragment key={o.id}>
                      <tr className="hover:bg-pink-50/30 transition-colors cursor-pointer" onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                            <div>
                              <p className="font-semibold text-gray-800">#{o.id}</p>
                              {(o as any).trackingId && <p className="text-xs text-gray-400 font-mono">{(o as any).trackingId}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {(o as any).userName ? (
                            <div>
                              <p className="font-medium text-gray-800 text-xs">{(o as any).userName}</p>
                              {!(o as any).userEmail?.endsWith("@clerk.user") && (o as any).userEmail && (
                                <p className="text-xs text-gray-400">{(o as any).userEmail}</p>
                              )}
                            </div>
                          ) : (o as any).shippingAddress?.fullName ? (
                            <p className="text-xs text-gray-600">{(o as any).shippingAddress.fullName}</p>
                          ) : (
                            <p className="text-xs text-gray-400">—</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded-lg font-medium text-gray-600 capitalize">{(o as any).paymentMethod ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                            <StatusIcon className="h-3 w-3" />{o.orderStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-800">৳{o.totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <Select value={o.orderStatus} onValueChange={(v) => handleOrderStatus(o.id, v)} disabled={o.orderStatus === "delivered" || o.orderStatus === "cancelled"}>
                            <SelectTrigger className={`w-34 text-xs h-8 rounded-lg border-gray-200 ${(o.orderStatus === "delivered" || o.orderStatus === "cancelled") ? "opacity-50 cursor-not-allowed" : ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["pending","confirmed","processing","shipped","delivered","cancelled"].map(s => (
                                <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${o.id}-expanded`} className="bg-pink-50/40">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                              {addr && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" /> Shipping Address
                                  </p>
                                  <p className="font-medium text-gray-800">{addr.fullName}</p>
                                  <p className="text-gray-500 text-xs">{addr.street ?? addr.line1}</p>
                                  <p className="text-gray-500 text-xs">{addr.city}{addr.district ? `, ${addr.district}` : ""}</p>
                                  {addr.phone && <p className="text-gray-500 text-xs mt-0.5">📞 {addr.phone}</p>}
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Items Ordered</p>
                                <div className="space-y-1">
                                  {((o as any).items ?? []).slice(0, 4).map((item: any) => (
                                    <p key={item.productId} className="text-xs text-gray-600">
                                      {item.productName} × {item.quantity} — ৳{(item.price * item.quantity).toLocaleString()}
                                    </p>
                                  ))}
                                  {((o as any).items ?? []).length > 4 && (
                                    <p className="text-xs text-gray-400">+{((o as any).items ?? []).length - 4} more items</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Info</p>
                                <p className="text-xs text-gray-600 capitalize">Method: {(o as any).paymentMethod}</p>
                                <p className={`text-xs capitalize ${(o as any).paymentStatus === "paid" ? "text-green-600" : "text-amber-600"}`}>
                                  Status: {(o as any).paymentStatus}
                                </p>
                                {(o as any).transactionId && (
                                  <p className="text-xs text-gray-500 font-mono mt-1">{(o as any).transactionId}</p>
                                )}
                                {(o as any).couponCode && (
                                  <p className="text-xs text-pink-500 mt-1">Coupon: {(o as any).couponCode} (−৳{(o as any).discountAmount})</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-12">No orders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Users Tab ─────────────────────────────────────────────────────────────
  const UsersTab = () => {
    const filteredUsers = (users ?? []).filter((u: any) =>
      !userSearch ||
      `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(userSearch.toLowerCase())
    );
    return (
      <div>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <p className="text-xs text-gray-400 shrink-0">{filteredUsers.length} customers</p>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className={`hover:bg-pink-50/30 transition-colors ${u.isBlocked ? "opacity-60" : ""}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${u.isBlocked ? "bg-red-100" : "bg-gradient-to-br from-pink-200 to-rose-300"}`}>
                          <span className={`text-xs font-bold ${u.isBlocked ? "text-red-500" : "text-rose-700"}`}>
                            {u.firstName?.[0] ?? ""}{u.lastName?.[0] ?? ""}{!u.firstName && !u.lastName ? "?" : ""}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "Unknown User"}
                          </p>
                          {u.isBlocked && <span className="text-xs text-red-500 font-medium">Blocked</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {u.email?.endsWith("@clerk.user") ? "—" : u.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-pink-100 text-pink-600" : "bg-gray-100 text-gray-500"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => {
                          const term = (u.email && !u.email.endsWith("@clerk.user"))
                            ? u.email
                            : `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
                          setUserSearch(""); setActiveTab("orders"); setTimeout(() => setOrderSearch(term), 50);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors"
                      >
                        {u.orderCount ?? 0} orders
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      {u.role !== "admin" && (
                        <button
                          onClick={() => handleToggleBlock(u.id, !u.isBlocked)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.isBlocked
                              ? "text-gray-400 hover:text-green-500 hover:bg-green-50"
                              : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                          }`}
                          title={u.isBlocked ? "Unblock user" : "Block user"}
                        >
                          {u.isBlocked ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-12">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ─── Reviews Tab ───────────────────────────────────────────────────────────
  const ReviewsTab = () => (
    <div>
      <div className="mb-4">
        <p className="text-sm text-gray-500">All customer reviews across every product. Delete any inappropriate or fake review.</p>
      </div>
      {reviewsLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : allReviews.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <MessageSquare className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-semibold text-gray-500 mb-1">No reviews yet</p>
          <p className="text-sm text-gray-400">Customer reviews will appear here once they start rolling in.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Review</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(allReviews as any[]).map((r) => (
                  <tr key={r.id} className="hover:bg-pink-50/30 transition-colors align-top">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {r.productImage ? (
                          <img src={r.productImage} alt="" className="h-10 w-10 rounded-xl object-cover border shrink-0" />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-gray-100 border shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-gray-800 text-xs leading-tight">{r.productName}</p>
                          <p className="text-xs text-gray-400">ID #{r.productId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-pink-200 to-rose-300 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-rose-700">{r.userName?.[0] ?? "?"}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-700">{r.userName}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{r.rating}/5</p>
                    </td>
                    <td className="px-5 py-4 max-w-[260px]">
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{r.comment}</p>
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-gray-400 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDeleteReview(r.productId, r.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete review"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Archived Orders Tab ────────────────────────────────────────────────────
  const ArchivedOrdersTab = () => (
    <div>
      <div className="mb-4">
        <p className="text-sm text-gray-500">Orders that were marked as <strong>delivered</strong> more than 2 days ago. Automatically moved here from the main Orders view.</p>
      </div>
      {ordersLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : archivedOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border p-14 text-center">
          <Archive className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-semibold text-gray-500 mb-1">No archived orders yet</p>
          <p className="text-sm text-gray-400">Delivered orders older than 2 days will appear here automatically.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivered</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {archivedOrders.map((o) => {
                  const sAddr = (o as any).shippingAddress as { fullName?: string } | null;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-gray-800">#{o.id}</p>
                        {(o as any).trackingId && <p className="text-xs text-gray-400 font-mono">{(o as any).trackingId}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        {(o as any).userName ? (
                          <div>
                            <p className="font-medium text-gray-800 text-xs">{(o as any).userName}</p>
                            {!(o as any).userEmail?.endsWith("@clerk.user") && (o as any).userEmail && (
                              <p className="text-xs text-gray-400">{(o as any).userEmail}</p>
                            )}
                          </div>
                        ) : sAddr?.fullName ? (
                          <p className="text-xs text-gray-600">{sAddr.fullName}</p>
                        ) : (
                          <p className="text-xs text-gray-400">—</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 max-w-[180px]">
                          {((o as any).items ?? []).slice(0, 2).map((item: any, idx: number) => (
                            <p key={idx} className="text-xs text-gray-600 truncate">{item.productName} ×{item.quantity}</p>
                          ))}
                          {((o as any).items ?? []).length > 2 && (
                            <p className="text-xs text-gray-400">+{((o as any).items ?? []).length - 2} more</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs">
                        {new Date(o.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded-lg font-medium text-gray-600 capitalize">{(o as any).paymentMethod ?? "—"}</span>
                          <span className={`ml-1.5 text-xs font-medium capitalize ${(o as any).paymentStatus === "paid" ? "text-green-600" : "text-amber-500"}`}>
                            · {(o as any).paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-800">৳{o.totalAmount.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Coupon Modal ──────────────────────────────────────────────────────────
  const CouponModal = ({ coupon, onClose }: { coupon?: any; onClose: () => void }) => {
    const [form, setForm] = useState({
      code: coupon?.code ?? "",
      discountType: coupon?.discountType ?? "percentage",
      discountValue: coupon?.discountValue ?? "",
      minOrderAmount: coupon?.minOrderAmount ?? "",
      expiryDate: coupon?.expiryDate ? coupon.expiryDate.slice(0, 10) : "",
    });

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      handleSaveCoupon({
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(String(form.discountValue)),
        minOrderAmount: form.minOrderAmount ? parseFloat(String(form.minOrderAmount)) : null,
        expiryDate: form.expiryDate || null,
      });
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-semibold text-lg">{coupon ? "Edit Coupon" : "New Coupon"}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Coupon Code *</Label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                required
                className="mt-1.5 rounded-xl font-mono"
                placeholder="SAVE20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Discount Type *</Label>
                <Select value={form.discountType} onValueChange={v => setForm(f => ({ ...f, discountType: v }))}>
                  <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (৳)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Value {form.discountType === "percentage" ? "(%)" : "(৳)"} *
                </Label>
                <Input
                  type="number"
                  value={form.discountValue}
                  onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                  required
                  className="mt-1.5 rounded-xl"
                  placeholder={form.discountType === "percentage" ? "20" : "500"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Min Order (৳)</Label>
                <Input
                  type="number"
                  value={form.minOrderAmount}
                  onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))}
                  className="mt-1.5 rounded-xl"
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={couponSaving} className="flex-1 rounded-xl bg-pink-500 hover:bg-pink-600 text-white">
                {coupon ? "Update Coupon" : "Create Coupon"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ─── Coupons Tab ───────────────────────────────────────────────────────────
  const CouponsTab = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Create and manage discount coupons for your customers.</p>
        <Button onClick={() => { setEditingCoupon(null); setShowCouponModal(true); }} className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> New Coupon
        </Button>
      </div>

      {couponsLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : coupons.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <Tag className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-semibold text-gray-500 mb-1">No coupons yet</p>
          <p className="text-sm text-gray-400 mb-4">Create your first discount coupon to boost sales.</p>
          <Button onClick={() => { setEditingCoupon(null); setShowCouponModal(true); }} className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Create Coupon
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Discount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Order</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coupons.map((c) => {
                  const isExpired = c.expiryDate && new Date(c.expiryDate) < new Date();
                  return (
                    <tr key={c.id} className={`hover:bg-pink-50/30 transition-colors ${!c.isActive ? "opacity-60" : ""}`}>
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg text-sm">{c.code}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-pink-600">
                          {c.discountType === "percentage" ? `${c.discountValue}%` : `৳${c.discountValue}`}
                        </span>
                        <span className="text-xs text-gray-400 ml-1 capitalize">{c.discountType}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {c.minOrderAmount ? `৳${c.minOrderAmount}` : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {c.expiryDate ? (
                          <span className={`text-xs ${isExpired ? "text-red-500 font-medium" : "text-gray-500"}`}>
                            {isExpired ? "Expired · " : ""}{new Date(c.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No expiry</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleCoupon(c.id)}
                          title={c.isActive ? "Deactivate" : "Activate"}
                          className="inline-flex items-center gap-1.5 text-xs font-medium"
                        >
                          {c.isActive
                            ? <><ToggleRight className="h-5 w-5 text-emerald-500" /><span className="text-emerald-600">Active</span></>
                            : <><ToggleLeft className="h-5 w-5 text-gray-400" /><span className="text-gray-400">Inactive</span></>
                          }
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setEditingCoupon(c); setShowCouponModal(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(c.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Monthly History Tab ───────────────────────────────────────────────────
  const MonthlyHistoryTab = () => {
    const monthNames = ["", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">
              Monthly revenue and order snapshots. Stats reset at the start of each month. Dashboard shows current month only.
            </p>
          </div>
          <Button variant="outline" onClick={handleArchiveNow} className="rounded-xl text-sm shrink-0">
            <Archive className="h-4 w-4 mr-1.5" /> Archive Last Month
          </Button>
        </div>

        {monthlyLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : monthlyRecords.length === 0 ? (
          <div className="bg-white rounded-2xl border p-14 text-center">
            <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="font-semibold text-gray-500 mb-1">No monthly records yet</p>
            <p className="text-sm text-gray-400 mb-4">Records are archived automatically on the 1st of each month, or manually via the button above.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue (Delivered)</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Archived On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthlyRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-pink-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800">{monthNames[r.month]} {r.year}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-semibold text-gray-700">{r.totalOrders}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-semibold text-emerald-600">৳{Number(r.totalRevenue).toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-gray-400">
                        {new Date(r.archivedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Settings Tab ──────────────────────────────────────────────────────────
  const SettingsTab = () => (
    <div className="max-w-2xl space-y-5">
      {[
        { label: "Store Name", value: "EnvyEnhance", desc: "Shown in the header and emails" },
        { label: "Support Email", value: "hello@envyenhance.com", desc: "Customers will see this address" },
        { label: "Currency", value: "BDT (৳)", desc: "Bangladeshi Taka" },
        { label: "Payment Methods", value: "bKash, Nagad, Cash on Delivery", desc: "Enabled at checkout" },
      ].map(({ label, value, desc }) => (
        <div key={label} className="bg-white border rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-gray-800">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-gray-700">{value}</p>
          </div>
        </div>
      ))}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
        Settings editing is managed via environment variables and seed scripts in this demo.
      </div>
    </div>
  );

  const tabContent: Record<string, React.ReactNode> = {
    dashboard:  <DashboardTab />,
    products:   <ProductsTab />,
    categories: <CategoriesTab />,
    orders:     <OrdersTab />,
    archived:   <ArchivedOrdersTab />,
    users:      <UsersTab />,
    reviews:    <ReviewsTab />,
    coupons:    <CouponsTab />,
    monthly:    <MonthlyHistoryTab />,
    settings:   <SettingsTab />,
  };

  const activeNav = navItems.find(n => n.id === activeTab);

  return (
    <div className="flex h-screen bg-[#fafafa] overflow-hidden font-sans">
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar mobile />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm sm:text-base">{activeNav?.label ?? "Dashboard"}</h1>
              <p className="text-xs text-gray-400 hidden sm:block">EnvyEnhance Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-300 to-rose-400 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{(me as any)?.firstName?.[0] ?? "A"}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-7xl mx-auto">
            {tabContent[activeTab]}
          </div>
        </main>
      </div>

      {(showProductModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          categories={categories as any[]}
          onClose={() => { setShowProductModal(false); setEditingProduct(null); }}
        />
      )}

      {(showCategoryModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
        />
      )}

      {(showCouponModal) && (
        <CouponModal
          coupon={editingCoupon}
          onClose={() => { setShowCouponModal(false); setEditingCoupon(null); }}
        />
      )}

      {/* Cancellation Reason Modal */}
      <Dialog open={!!cancelModal} onOpenChange={(open) => { if (!open) setCancelModal(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Provide a reason for cancellation (optional). This will be visible to the customer.</p>
            <Textarea
              placeholder="e.g. Item out of stock, customer requested cancellation…"
              className="rounded-xl resize-none text-sm"
              rows={3}
              value={cancelModal?.reason ?? ""}
              onChange={e => setCancelModal(m => m ? { ...m, reason: e.target.value } : m)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setCancelModal(null)}>
              Keep Order
            </Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              disabled={updateOrderStatus.isPending}
              onClick={confirmCancellation}
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
