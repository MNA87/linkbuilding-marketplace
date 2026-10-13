// The marketplace carries a parallel "@modal" slot so the order screen can
// open as a popup over the list (intercepting route) on a normal click, while
// a direct link / refresh still shows the full /marketplace/[id] page.
export default function MarketplaceLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
