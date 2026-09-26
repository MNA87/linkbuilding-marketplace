// A small flag for a country code; tricolours only, as inline SVG so it
// looks the same everywhere (emoji flags show as letters on Windows).
const FLAGS: Record<string, { stripes: [string, string, string]; vertical: boolean }> = {
  NL: { stripes: ["#AE1C28", "#FFFFFF", "#21468B"], vertical: false },
  BE: { stripes: ["#000000", "#FDDA24", "#EF3340"], vertical: true },
  DE: { stripes: ["#000000", "#DD0000", "#FFCE00"], vertical: false },
  FR: { stripes: ["#002654", "#FFFFFF", "#CE1126"], vertical: true },
};

export default function CountryFlag({ code, label }: { code: string; label: string }) {
  const flag = FLAGS[code.toUpperCase()];
  if (!flag) return <span className="text-ink/80">{label}</span>;
  return (
    <svg
      viewBox="0 0 30 20"
      width={24}
      height={16}
      role="img"
      aria-label={label}
      className="shrink-0 rounded-[3px] ring-1 ring-black/10"
    >
      <title>{label}</title>
      {flag.stripes.map((color, i) =>
        flag.vertical ? (
          <rect key={i} x={i * 10} y={0} width={10} height={20} fill={color} />
        ) : (
          <rect key={i} x={0} y={(i * 20) / 3} width={30} height={20 / 3 + 0.1} fill={color} />
        )
      )}
    </svg>
  );
}
