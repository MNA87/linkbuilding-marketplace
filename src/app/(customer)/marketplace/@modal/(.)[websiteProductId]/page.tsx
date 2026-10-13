import RouteModal from "@/components/RouteModal";
import OrderPanel from "@/app/(customer)/marketplace/[websiteProductId]/OrderPanel";

// Intercepts /marketplace/[websiteProductId] on a client-side navigation from
// the marketplace and shows the same order screen (OrderPanel) in a popup.
export default async function InterceptedOrderModal({
  params,
  searchParams,
}: {
  params: Promise<{ websiteProductId: string }>;
  searchParams: Promise<{ orderItemId?: string; nieuw?: string; stap?: string; van?: string }>;
}) {
  const { websiteProductId } = await params;
  const { orderItemId, nieuw, stap, van } = await searchParams;
  return (
    <RouteModal>
      <OrderPanel
        websiteProductId={websiteProductId}
        orderItemId={orderItemId}
        nieuw={nieuw}
        stap={stap}
        van={van}
        inModal
      />
    </RouteModal>
  );
}
