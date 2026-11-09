import type { Metadata } from "next";
import { getPageSeo } from "@/lib/cms/content";
import LegalPage from "@/components/public/LegalPage";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSeo("voorwaarden");
  return { title: { absolute: seo.title }, description: seo.description || undefined };
}

export default async function Page({ searchParams }: Props) {
  return <LegalPage slug="voorwaarden" searchParams={await searchParams} />;
}
