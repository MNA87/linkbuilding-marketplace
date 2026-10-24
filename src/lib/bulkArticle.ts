// Gedeelde "is dit écht ingevuld?"-checks voor de bulk-flow. Zowel de client
// (BulkOrder) als de server (actions) gebruiken deze, zodat de twee nooit uit
// elkaar lopen — een regel die in de UI "klaar" oogt, moet op de server ook
// echt klaar zijn, en andersom.

// Of een rich-text body écht een artikel bevat: HTML-tags eruit, entities
// (&nbsp;, &amp; …) als spatie, dan de letters/cijfers tellen. Pas vanaf 10
// echte letters/cijfers telt het mee — zo glipt een lege editor ("<p></p>"),
// een spatie/&nbsp;, een los leesteken (". ' ,") of één kort woord er niet
// doorheen als aangeleverde inhoud.
const MIN_ARTICLE_CHARS = 10;
export function htmlHasText(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Letters (incl. accenten als é/ë) en cijfers; leestekens/symbolen tellen niet.
  const wordChars = (text.match(/[0-9A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? []).length;
  return wordChars >= MIN_ARTICLE_CHARS;
}

// Of een doel-URL op een écht website-adres lijkt: een nette hostnaam met een
// TLD van minstens 2 letters (bijv. nu.nl, example.com, sub.domein.co.uk).
// Zo wordt onzin als "Gggg.n" (TLD van één letter) of "foo" (geen punt)
// geweigerd, zonder geldige URL's met pad/subdomein/https tegen te houden.
export function looksLikeSite(url: string): boolean {
  const host = url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .split(":")[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host);
}
