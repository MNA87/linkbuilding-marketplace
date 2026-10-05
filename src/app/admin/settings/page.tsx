import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MasterDataSection from "./MasterDataSection";
import NoindexToggle from "./NoindexToggle";
import AutoPublishToggle from "./AutoPublishToggle";
import ButtonColorsSettings from "./ButtonColorsSettings";
import MenuColorsSettings from "./MenuColorsSettings";
import WritingPriceSetting from "./WritingPriceSetting";
import ApiKeysSettings from "./ApiKeysSettings";
import MailboxSettings from "./MailboxSettings";
import { mailboxStatus } from "@/lib/mailbox";
import MetricsOverview from "./MetricsOverview";
import BackupOverview from "./BackupOverview";
import StorageOverview from "./StorageOverview";
import { legacyStatus, type LegacyStatus } from "@/lib/storageMigration";
import {
  ALERT_AFTER_HOURS,
  SAFETY_LABEL,
  backupTime,
  listBackups,
  storageConfigured,
  type BackupObject,
} from "@/lib/databaseBackup";
import { metricsOverview } from "@/lib/websiteMetrics";
import { nlDate } from "@/lib/customerOrders";
import { credentialStatuses } from "@/lib/apiCredentials";
import DetailsForm from "@/components/DetailsForm";
import { setSellerDetailsAction } from "./actions";
import { getNoindexEnabled, getAutoPublishEnabled, getButtonColors, getMenuColors } from "@/lib/siteSettings";

export const metadata: Metadata = { title: "Instellingen" };

// One section at a time, picked with the tabs at the top (?tab=).
const TABS = [
  { key: "algemeen", label: "Algemeen" },
  { key: "kleuren", label: "Kleuren" },
  { key: "bedrijfsgegevens", label: "Bedrijfsgegevens" },
  { key: "koppelingen", label: "Koppelingen" },
  { key: "keuzelijsten", label: "Categorieën, landen en talen" },
  { key: "systeem", label: "Systeem" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requested = (await searchParams).tab;
  const tab: TabKey = TABS.find((t) => t.key === requested)?.key ?? "algemeen";
  const topics = await prisma.topic.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { prices: true } } },
  });
  const [categories, countries, languages, noindexEnabled, autoPublishEnabled, buttonColors, menuColors, settings, credentials] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.country.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    prisma.language.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { websites: true } } } }),
    getNoindexEnabled(),
    getAutoPublishEnabled(),
    getButtonColors(),
    getMenuColors(),
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
    credentialStatuses(),
  ]);
  const overview = tab === "koppelingen" ? await metricsOverview() : null;
  const mailbox = tab === "koppelingen" ? await mailboxStatus() : null;
  const backups: BackupObject[] | null =
    tab === "systeem" && storageConfigured() ? await listBackups().catch(() => null) : null;
  const legacy: LegacyStatus | null = tab === "systeem" ? await legacyStatus().catch(() => null) : null;
  const sellerComplete = Boolean(settings?.sellerName && settings.sellerKvk && settings.sellerVatNumber);

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-2xl text-ink">Instellingen</h1>

      <nav className="mt-4 flex flex-wrap gap-x-1 border-b border-line" aria-label="Onderdelen">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "algemeen" ? "/admin/settings" : `/admin/settings?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${
              t.key === tab ? "border-ink font-semibold text-ink" : "border-transparent text-inkSoft hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "bedrijfsgegevens" && !sellerComplete && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" title="Nog niet ingevuld" />
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-6 max-w-3xl space-y-6">
        {tab === "algemeen" && (
          <>
            <NoindexToggle initialNoindexEnabled={noindexEnabled} />
            <AutoPublishToggle initialAutoPublishEnabled={autoPublishEnabled} />
            <WritingPriceSetting initialPrice={Number(settings?.writingPrice ?? 25)} />
          </>
        )}

        {tab === "kleuren" && (
          <>
            <ButtonColorsSettings initialColors={buttonColors} />
            <MenuColorsSettings initialColors={menuColors} />
          </>
        )}

        {tab === "bedrijfsgegevens" && (
          <div className="bg-surface border border-line rounded-lg p-4 space-y-3">
            <div>
              <h2 className="font-medium text-ink">Bedrijfsgegevens op facturen</h2>
              <p className="text-sm text-inkSoft">
                Deze gegevens komen als verkoper op elke nieuwe factuur. Een factuur die al is gemaakt, verandert niet
                mee.
              </p>
            </div>
            {!sellerComplete && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Nog niet ingevuld — zonder bedrijfsnaam, KvK- en BTW-nummer zijn facturen niet volledig.
              </div>
            )}
            <DetailsForm
              action={setSellerDetailsAction}
              initialValues={{
                sellerName: settings?.sellerName ?? "",
                sellerAddress: settings?.sellerAddress ?? "",
                sellerPostcode: settings?.sellerPostcode ?? "",
                sellerCity: settings?.sellerCity ?? "",
                sellerKvk: settings?.sellerKvk ?? "",
                sellerVatNumber: settings?.sellerVatNumber ?? "",
                sellerIban: settings?.sellerIban ?? "",
                sellerEmail: settings?.sellerEmail ?? "",
              }}
              fields={[
                { name: "sellerName", label: "Bedrijfsnaam", wide: true },
                { name: "sellerAddress", label: "Adres", placeholder: "Straat en huisnummer", wide: true },
                { name: "sellerPostcode", label: "Postcode", placeholder: "1234 AB" },
                { name: "sellerCity", label: "Plaats" },
                { name: "sellerKvk", label: "KvK-nummer", placeholder: "12345678" },
                { name: "sellerVatNumber", label: "BTW-nummer", placeholder: "NL123456789B01" },
                { name: "sellerIban", label: "IBAN", optional: true },
                { name: "sellerEmail", label: "E-mailadres", optional: true },
              ]}
            />
          </div>
        )}

        {tab === "koppelingen" && (
          <>
            <ApiKeysSettings statuses={credentials} />
            {mailbox && <MailboxSettings status={mailbox} ownEmails={settings?.ownEmails ?? []} />}
            {overview && (
              <MetricsOverview
                sites={overview.map((site) => ({
                  id: site.id,
                  domain: site.domain,
                  lastRun: site.lastRun ? nlDate(site.lastRun) : null,
                  nextRun: site.nextRun.getTime() <= Date.now() ? "Binnen het uur" : nlDate(site.nextRun),
                }))}
              />
            )}
          </>
        )}

        {tab === "systeem" && legacy?.configured && (
          <StorageOverview total={legacy.total} pending={legacy.pending.length} />
        )}

        {tab === "systeem" && (
          <BackupOverview
            configured={storageConfigured()}
            enabled={settings?.ownBackupsEnabled ?? true}
            restored={
              settings?.restoredAt && settings.restoredFrom
                ? `Laatst teruggezet op ${when(settings.restoredAt)}: de kopie van ${
                    backupTime(settings.restoredFrom) ? when(backupTime(settings.restoredFrom)!) : settings.restoredFrom
                  }.`
                : null
            }
            healthy={Boolean(
              backups?.[0] && Date.now() - backups[0].createdAt.getTime() < ALERT_AFTER_HOURS * 60 * 60 * 1000
            )}
            latest={backups?.[0] ? `${when(backups[0].createdAt)} (${ago(backups[0].createdAt)})` : null}
            duration={
              settings?.backupLastDurationMs != null && !settings.backupLastError
                ? settings.backupLastDurationMs < 1000
                  ? "minder dan 1 seconde"
                  : `${(settings.backupLastDurationMs / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} seconden`
                : null
            }
            lastError={backups === null && storageConfigured() ? "De bestandsopslag is niet bereikbaar." : settings?.backupLastError ?? null}
            count={backups?.length ?? 0}
            totalSize={fileSize(backups?.reduce((sum, b) => sum + b.size, 0) ?? 0)}
            rows={(backups ?? []).slice(0, 10).map((b) => ({
              key: b.key,
              when: when(b.createdAt),
              size: fileSize(b.size),
              safety: b.label === SAFETY_LABEL,
            }))}
          />
        )}

        {tab === "keuzelijsten" && (
          <>
            <p className="text-sm text-inkSoft">Wat suppliers kunnen kiezen bij hun websites.</p>
            <MasterDataSection
              title="Onderwerpen van links"
              note="Waar een link over kan gaan naast Algemeen. Per website zet je onder Websites een prijs per onderwerp; zonder prijs plaatst die site het onderwerp niet."
              kind="topic"
              items={topics.map((t) => ({ id: t.id, label: t.name, inUse: t._count.prices > 0 }))}
            />
            <MasterDataSection
              title="Categorieën (niches)"
              kind="category"
              items={categories.map((c) => ({ id: c.id, label: c.name, inUse: c._count.websites > 0 }))}
            />
            <MasterDataSection
              title="Landen"
              kind="country"
              withCode
              items={countries.map((c) => ({ id: c.id, label: `${c.name} (${c.code})`, inUse: c._count.websites > 0 }))}
            />
            <MasterDataSection
              title="Talen"
              kind="language"
              withCode
              items={languages.map((l) => ({ id: l.id, label: `${l.name} (${l.code})`, inUse: l._count.websites > 0 }))}
            />
          </>
        )}
      </div>
    </div>
  );
}

const when = (d: Date) =>
  d.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });

function ago(d: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} uur geleden` : `${Math.round(hours / 24)} dagen geleden`;
}

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / 1024 / 1024).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} MB`;
}
