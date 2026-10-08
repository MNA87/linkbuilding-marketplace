import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ListManager, { type ListItem } from "./ListManager";
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
import { setSellerDetailsAction, setWhatsappAction } from "./actions";
import { getNoindexEnabled, getAutoPublishEnabled, getButtonColors, getMenuColors } from "@/lib/siteSettings";

export const metadata: Metadata = { title: "Instellingen" };

// One section at a time, picked with the tabs at the top (?tab=).
const TABS = [
  { key: "algemeen", label: "Algemeen" },
  { key: "kleuren", label: "Kleuren" },
  { key: "bedrijfsgegevens", label: "Bedrijfsgegevens" },
  { key: "koppelingen", label: "Koppelingen" },
  { key: "keuzelijsten", label: "Lijsten" },
  { key: "systeem", label: "Systeem" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const LISTS = [
  { key: "niches", label: "Niches" },
  { key: "onderwerpen", label: "Onderwerpen" },
  { key: "landen", label: "Landen" },
  { key: "talen", label: "Talen" },
] as const;

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; lijst?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.tab;
  const list = LISTS.find((l) => l.key === sp.lijst)?.key ?? "niches";
  const tab: TabKey = TABS.find((t) => t.key === requested)?.key ?? "algemeen";
  const [lists, noindexEnabled, autoPublishEnabled, buttonColors, menuColors, settings, credentials] =
    await Promise.all([
      tab === "keuzelijsten" ? listItems() : null,
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
              <span
                className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle"
                title="Nog niet ingevuld"
              />
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

        {tab === "bedrijfsgegevens" && (
          <div className="bg-surface border border-line rounded-lg p-4 space-y-3">
            <div>
              <h2 className="font-medium text-ink">Contact voor klanten</h2>
              <p className="text-sm text-inkSoft">
                Met een nummer staat er bovenin bij klanten een knop &ldquo;WhatsApp&rdquo; (op werkdagen van 9 tot 17
                uur met &ldquo;Nu bereikbaar&rdquo;). Leeg laten: geen knop. Het e-mailadres hierboven staat er ook.
              </p>
            </div>
            <DetailsForm
              action={setWhatsappAction}
              initialValues={{ whatsappNumber: settings?.whatsappNumber ?? "" }}
              fields={[
                { name: "whatsappNumber", label: "WhatsApp-nummer", placeholder: "06 12345678", optional: true },
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
            lastError={
              backups === null && storageConfigured()
                ? "De bestandsopslag is niet bereikbaar."
                : (settings?.backupLastError ?? null)
            }
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

        {tab === "keuzelijsten" && lists && (
          <>
            <p className="text-sm text-inkSoft">De keuzes bij je websites en in de Marketplace.</p>
            <nav className="flex flex-wrap gap-2" aria-label="Lijst">
              {LISTS.map((l) => (
                <Link
                  key={l.key}
                  href={`/admin/settings?tab=keuzelijsten${l.key === "niches" ? "" : `&lijst=${l.key}`}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    l.key === list
                      ? "border-[var(--btn-pay-bg)] bg-[var(--pay-soft)] font-semibold text-[var(--btn-pay-bg)]"
                      : "border-line bg-surface text-ink/80 hover:bg-gray-50"
                  }`}
                >
                  {l.label}
                  <span className={l.key === list ? "font-normal" : "text-inkSoft"}>{lists[l.key].length}</span>
                </Link>
              ))}
            </nav>
            <ListManager
              key={list}
              kind={({ niches: "category", onderwerpen: "topic", landen: "country", talen: "language" } as const)[list]}
              items={lists[list]}
              note={
                list === "onderwerpen"
                  ? "Waar een link over kan gaan naast Algemeen. Per website zet je onder Websites een prijs per onderwerp; zonder prijs plaatst die site het onderwerp niet."
                  : undefined
              }
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

// Each list with how many websites use each entry (a niche: as main or
// extra niche; a topic: with a price for it).
async function listItems(): Promise<Record<(typeof LISTS)[number]["key"], ListItem[]>> {
  const [categories, topics, countries, languages, websites, topicPrices] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.topic.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.country.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.language.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.website.findMany({
      select: { id: true, categoryId: true, countryId: true, languageId: true, niches: { select: { id: true } } },
    }),
    prisma.websiteProductTopicPrice.findMany({
      select: { topicId: true, websiteProduct: { select: { websiteId: true } } },
    }),
  ]);
  const count = (pairs: [string, string][]) => {
    const sites = new Map<string, Set<string>>();
    for (const [key, site] of pairs) sites.set(key, (sites.get(key) ?? new Set()).add(site));
    return (key: string) => sites.get(key)?.size ?? 0;
  };
  const nicheCount = count(
    websites.flatMap(
      (w) => [[w.categoryId, w.id], ...w.niches.map((n): [string, string] => [n.id, w.id])] as [string, string][]
    )
  );
  const topicCount = count(topicPrices.map((p) => [p.topicId, p.websiteProduct.websiteId]));
  const countryCount = count(websites.map((w) => [w.countryId, w.id]));
  const languageCount = count(websites.map((w) => [w.languageId, w.id]));
  return {
    niches: categories.map((c) => ({ ...c, count: nicheCount(c.id) })),
    onderwerpen: topics.map((t) => ({ ...t, count: topicCount(t.id) })),
    landen: countries.map((c) => ({ ...c, count: countryCount(c.id) })),
    talen: languages.map((l) => ({ ...l, count: languageCount(l.id) })),
  };
}
