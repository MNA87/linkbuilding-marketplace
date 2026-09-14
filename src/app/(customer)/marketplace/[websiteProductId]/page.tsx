import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePriceForWebsiteProduct } from "@/lib/pricing";
import OrderForm from "./OrderForm";

export default async function OrderPage({ params }: { params: { websiteProductId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");

  const websiteProduct = await prisma.websiteProduct.findUnique({
    where: { id: params.websiteProductId },
    include: { website: { include: { category: true, country: true, language: true } }, product: true },
  });
  if (!websiteProduct || !websiteProduct.isAvailable || websiteProduct.website.status !== "ACTIVE") {
    notFound();
  }

  const { customerPrice } = await computePriceForWebsiteProduct(websiteProduct.id);

  const projects = await prisma.project.findMany({
    where: { customerCompanyId: session.user.companyId ?? undefined },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Bestellen: {websiteProduct.website.domain}</h1>
      <p className="text-sm text-inkSoft mb-6">
        {websiteProduct.product.name} &middot; {websiteProduct.website.category.name} &middot; &euro;
        {customerPrice.toFixed(2)}
      </p>
      <OrderForm websiteProductId={websiteProduct.id} price={customerPrice.toFixed(2)} projects={projects} />
    </div>
  );
}
