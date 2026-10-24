// Gedeelde "is dit écht ingevuld?"-checks voor de bulk-flow. Zowel de client
// (BulkOrder) als de server (actions) gebruiken deze, zodat de twee nooit uit
// elkaar lopen — een regel die in de UI "klaar" oogt, moet op de server ook
// echt klaar zijn, en andersom.

// Of een rich-text body écht tekst bevat: HTML-tags eruit, &nbsp; als spatie,
// dan trimmen. Zo telt een lege editor ("<p></p>"), een enkele spatie of een
// losse &nbsp; NIET als aangeleverd artikel.
export function htmlHasText(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}

// Of een doel-URL op een echte site lijkt (iets met een punt, bijv. nu.nl) —
// zodat een ankertekst alleen nooit als ingevulde link telt.
export function looksLikeSite(url: string): boolean {
  return /[^.\s]\.[^.\s]/.test(url.trim());
}
