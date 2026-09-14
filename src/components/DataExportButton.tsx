export default function DataExportButton() {
  return (
    <a
      href="/api/account/export"
      className="text-sm text-brand hover:underline"
    >
      Download mijn gegevens (JSON)
    </a>
  );
}
