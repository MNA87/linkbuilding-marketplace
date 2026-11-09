import type { Metadata } from "next";
import { listMedia } from "@/lib/cms/media";
import { storageConfigured } from "@/lib/storage";
import MediaLibrary from "./MediaLibrary";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  const items = await listMedia();
  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-2xl text-ink sm:text-3xl">Media</h1>
      <p className="mt-1 text-sm text-inkSoft">Afbeeldingen voor de blog en de publieke site.</p>
      {!storageConfigured("uploads") && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Er is geen bestandsopslag ingesteld; afbeeldingen worden nu in de database bewaard. Dat werkt, maar stel voor productie de uploads-bucket in.
        </p>
      )}
      <div className="mt-5">
        <MediaLibrary initial={items} />
      </div>
    </div>
  );
}
