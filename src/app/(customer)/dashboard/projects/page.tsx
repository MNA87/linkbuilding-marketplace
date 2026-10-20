import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewProjectForm from "./NewProjectForm";

export const metadata: Metadata = { title: "Projecten" };

export default async function CustomerProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");

  const [projects, counts] = await Promise.all([
    prisma.project.findMany({
      where: { customerCompanyId: session.user.companyId },
      orderBy: { createdAt: "desc" },
    }),
    // Tel per project de plaatsingen (regel-niveau: OrderItem.projectId), niet de
    // orders — want orders hangen aan het verzamel-project "Bestellingen".
    prisma.orderItem.groupBy({
      by: ["projectId"],
      where: {
        projectId: { not: null },
        renewsOrderItemId: null,
        order: { customerId: session.user.id, status: { not: "NEW" } },
      },
      _count: { _all: true },
    }),
  ]);
  const countByProject = new Map(counts.map((c) => [c.projectId, c._count._all]));

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Projecten</h1>
      <p className="text-sm text-inkSoft mb-6">{projects.length} project(en)</p>

      <div className="space-y-2 mb-6">
        {projects.map((p) => {
          const n = countByProject.get(p.id) ?? 0;
          return (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-[var(--btn-pay-bg)] hover:bg-gray-50/60"
            >
              <Folder size={18} className="shrink-0 text-[var(--btn-pay-bg)]" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{p.name}</div>
                {p.targetWebsite && <div className="text-sm text-inkSoft">{p.targetWebsite}</div>}
                {p.notes && <div className="mt-1 text-sm text-inkSoft">{p.notes}</div>}
                <div className="mt-2 text-xs text-inkSoft">{n} {n === 1 ? "plaatsing" : "plaatsingen"}</div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-inkSoft transition-colors group-hover:text-[var(--btn-pay-bg)]" />
            </Link>
          );
        })}
        {projects.length === 0 && (
          <div className="bg-surface border border-line rounded-lg p-8 text-center text-inkSoft text-sm">
            Nog geen projecten.
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-lg p-6">
        <h2 className="font-medium text-ink mb-3">Nieuw project</h2>
        <NewProjectForm />
      </div>
    </div>
  );
}
