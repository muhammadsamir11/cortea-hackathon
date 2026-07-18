// Normalizers for bilingual (DE/EN) financial documents.

export function normalizeIban(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s) ? s : null;
}

const LEGAL_SUFFIXES =
  /\b(gmbh & co\.? kg|gmbh|ag|se|kg|ohg|ug|e\.?v\.?|ltd\.?|limited|inc\.?|llc|plc|b\.?v\.?|s\.?a\.?|s\.?r\.?l\.?|corp\.?|co\.?)\b/gi;

/** Fuzzy identity key for entity names across DE/EN variants. */
export function nameKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n]!;
}

export function namesSimilar(a: string, b: string): boolean {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const d = levenshtein(ka, kb);
  return d <= Math.max(1, Math.floor(Math.min(ka.length, kb.length) * 0.15));
}

/** Parse "12.500,00" / "12,500.00" / "12500" / "€ 1.234,56" -> number. */
export function parseAmount(raw: string | number | undefined | null): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = raw.replace(/[^\d.,\-]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    // last separator wins as decimal
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const frac = s.length - lastComma - 1;
    s = frac === 3 && s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(/,/g, frac === 3 ? "" : ".");
  } else if (lastDot !== -1) {
    const frac = s.length - lastDot - 1;
    if (frac === 3) s = s.replace(/\./g, ""); // 12.500 (German thousands)
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Whitespace/typography-insensitive form used for quote validation. */
export function canonText(raw: string): string {
  return raw
    .replace(/[­​‌‍]/g, "") // soft hyphen, zero-widths
    .replace(/[„“”«»"]/g, '"')
    .replace(/[’‘`´]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Aggressive form: no whitespace at all (survives PDF line-break mangling). */
export function canonTight(raw: string): string {
  return canonText(raw).replace(/\s+/g, "");
}

/** Does `quote` appear inside `text` (typography/whitespace-insensitive)? */
export function quoteInText(quote: string, text: string): boolean {
  const q = canonText(quote);
  if (!q) return false;
  if (canonText(text).includes(q)) return true;
  return canonTight(text).includes(canonTight(quote));
}
