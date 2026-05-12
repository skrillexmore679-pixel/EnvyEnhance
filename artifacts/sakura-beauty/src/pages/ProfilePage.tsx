import { useUser, UserProfile } from "@clerk/react";
import { useGetMe, useListOrders } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Package2, ArrowRight } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function ProfilePage() {
  const { user } = useUser();
  const { data: dbUser } = useGetMe({ query: { retry: false, queryKey: ["me"] } });
  const { data: orders, isLoading: ordersLoading } = useListOrders();

  const recentOrders = (orders ?? []).slice(0, 3);
  const isAdmin = dbUser?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-muted/30 border-b py-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            {user?.imageUrl && (
              <img src={user.imageUrl} alt="Profile" className="h-14 w-14 rounded-full object-cover border" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-3xl font-medium">{user?.fullName ?? "Your Profile"}</h1>
                {isAdmin && (
                  <Link href="/admin">
                    <Badge className="bg-accent text-accent-foreground cursor-pointer hover:opacity-80 transition-opacity">
                      Admin
                    </Badge>
                  </Link>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Recent orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">Recent Orders</h2>
              <Link href="/orders">
                <span className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
            {ordersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="bg-card border rounded-xl p-8 text-center">
                <Package2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`}>
                    <div className="bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Order #{order.id}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.orderStatus] ?? "bg-muted"}`}>
                            {order.orderStatus}
                          </span>
                          <p className="text-sm font-medium mt-1">৳{order.totalAmount.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Account settings */}
          <div>
            <h2 className="font-medium mb-4">Account Settings</h2>
            <div className="bg-card border rounded-xl overflow-hidden">
              <UserProfile
                appearance={{
                  elements: {
                    card: "shadow-none border-0 p-0 rounded-none",
                    rootBox: "w-full",
                    pageScrollBox: "p-4",
                    navbar: "hidden",
                    navbarMobileMenuButton: "hidden",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
