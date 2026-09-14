import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CartItemRow from "./CartItemRow";
import CheckoutButton from "./CheckoutButton";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const carts = await prisma.order.findMany({
    where: { customerId: session.user.id, status: "NEW" },
    include: {
      project: true,
      items: { include: { websiteProduct: { include: { website: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Winkelmandje</h1>
      <p className="text-sm text-inkSoft mb-6">
        {carts.reduce((sum, c) => sum + c.items.length, 0)} item(s) klaar om af te rekenen
      </p>

      {checkout === "cancelled" && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Betaling geannuleerd. Je mandje staat nog klaar.
        </div>
      )}

      {carts.length === 0 && (
        <div className="bg-surface border border-line rounded-lg p-8 text-center text-inkSoft text-sm">
          Je winkelmandje is leeg.{" "}
          <Link href="/marketplace" className="text-brand hover:underline">
            Bekijk de marketplace
          </Link>
          .
        </div>
      )}

      <div className="space-y-6">
        {carts.map((cart) => {
          const total = cart.items.reduce((sum, i) => sum + i.customerPriceSnap.toNumber(), 0);
          return (
            <div key={cart.id} className="bg-surface border border-line rounded-lg p-4">
              <div className="font-medium text-ink mb-3">{cart.project.name}</div>
              <div className="space-y-2 mb-4">
                {cart.items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    orderItemId={item.id}
                    domain={item.websiteProduct.website.domain}
                    anchorText={item.anchorText}
                    price={item.customerPriceSnap.toFixed(2)}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-line">
                <div className="text-sm text-inkSoft">
                  Totaal: <span className="text-ink font-medium">&euro;{total.toFixed(2)}</span>
                </div>
                <CheckoutButton orderId={cart.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
