import { useParams } from "wouter";
import { useGetOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, Package, Truck, Home, ChevronLeft } from "lucide-react";
import { Link } from "wouter";

const STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const { data: order, isLoading } = useGetOrder(id, { query: { enabled: !!id, queryKey: ["order", id] } });

  if (isLoading) {
    return <div className="container mx-auto px-4 py-10"><Skeleton className="h-96 rounded-xl" /></div>;
  }
  if (!order) {
    return <div className="py-20 text-center text-muted-foreground">Order not found.</div>;
  }

  const currentStep = STEPS.indexOf(order.orderStatus);
  const addr = order.shippingAddress as { fullName?: string; street?: string; line1?: string; city?: string; district?: string; phone?: string } | null;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-muted/30 border-b py-10">
        <div className="container mx-auto px-4">
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="mb-4 gap-1 text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> My Orders
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-3xl font-medium">Order #{order.id}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{new Date(order.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[order.orderStatus] ?? "bg-muted"}`}>
              {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Continue Shopping */}
        <div className="flex">
          <a href="/products">
            <button className="px-6 py-2.5 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
              ← Continue Shopping
            </button>
          </a>
        </div>

        {/* Cancellation notice */}
        {order.orderStatus === "cancelled" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-600 text-lg">✕</span>
              </div>
              <div>
                <p className="font-medium text-red-700 text-sm">This order has been cancelled</p>
                {(order as any).cancellationReason ? (
                  <p className="text-sm text-red-600 mt-1">Reason: {(order as any).cancellationReason}</p>
                ) : (
                  <p className="text-sm text-red-500 mt-1">No reason provided.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tracking steps */}
        {order.orderStatus !== "cancelled" && (
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-medium mb-6">Order Progress</h2>
            <div className="flex items-center gap-0">
              {STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                const icons = [Circle, CheckCircle2, Package, Truck, Home];
                const Icon = icons[Math.min(i, icons.length - 1)];
                return (
                  <div key={step} className="flex-1 flex flex-col items-center relative">
                    {i < STEPS.length - 1 && (
                      <div className={`absolute top-5 left-1/2 w-full h-0.5 ${done ? "bg-accent" : "bg-border"}`} />
                    )}
                    <div className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors ${done ? "bg-accent border-accent text-white" : active ? "bg-background border-primary" : "bg-background border-border text-muted-foreground"}`}>
                      {done ? <CheckCircle2 className="h-5 w-5 text-white" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <p className={`text-xs mt-2 capitalize text-center ${active ? "font-medium" : "text-muted-foreground"}`}>{step}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-medium mb-4">Items Ordered</h2>
          <div className="divide-y">
            {(order.items ?? []).map((item) => {
              const img = item.productImage ?? "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=200&q=80";
              return (
                <div key={item.productId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <img src={img} alt={item.productName} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                  <div className="flex-1 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-sm">৳{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary + address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-medium text-sm mb-3 uppercase tracking-wider">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="capitalize text-green-600">{order.paymentStatus}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>৳{order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {addr && (
            <div className="bg-card border rounded-xl p-5">
              <h3 className="font-medium text-sm mb-3 uppercase tracking-wider">Delivery Address</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{addr.fullName}</p>
                <p>{addr.street ?? addr.line1}</p>
                <p>{addr.city}{addr.district ? `, ${addr.district}` : ""}</p>
                {addr.phone && <p>📞 {addr.phone}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
