import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostForEditor, listCategories } from "@/lib/cms/blogContent";
import BlogEditor from "../BlogEditor";

export const metadata: Metadata = { title: "Bericht bewerken" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, categories] = await Promise.all([getPostForEditor(id), listCategories()]);
  if (!post) notFound();
  return <BlogEditor post={post} categories={categories} />;
}
