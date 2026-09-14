import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="text-center">
        <div className="font-serif text-5xl text-ink mb-2">404</div>
        <p className="text-sm text-inkSoft mb-6">Deze pagina bestaat niet (meer).</p>
        <Link href="/" className="text-brand text-sm hover:underline">
          Terug naar het begin
        </Link>
      </div>
    </div>
  );
}
