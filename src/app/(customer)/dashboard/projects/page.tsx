import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewProjectForm from "./NewProjectForm";

export default async function CustomerProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer" || !session.user.companyId) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { customerCompanyId: session.user.companyId },
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl text-ink mb-1">Projecten</h1>
      <p className="text-sm text-inkSoft mb-6">{projects.length} project(en)</p>

      <div className="space-y-2 mb-6">
        {projects.map((p) => (
          <div key={p.id} className="bg-surface border border-line rounded-lg p-4">
            <div className="font-medium text-ink">{p.name}</div>
            {p.targetWebsite && <div className="text-sm text-inkSoft">{p.targetWebsite}</div>}
            {p.notes && <div className="text-sm text-inkSoft mt-1">{p.notes}</div>}
            <div className="text-xs text-inkSoft mt-2">{p._count.orders} order(s)</div>
          </div>
        ))}
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
