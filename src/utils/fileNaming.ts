export function sanitizeTitleToAscii(title: string): string {
  try {
    return title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9\s-_]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  } catch {
    return title.replace(/\s+/g, "-");
  }
}

export function buildFileName(category: string, title: string, externalId: string, intro?: number | null, eom?: number | null, ext = "wav", extraMeta?: Record<string, string | number> | null) {
  const safeCat = sanitizeTitleToAscii(category || "Other");
  const safeTitle = sanitizeTitleToAscii(title || "Untitled");
  const parts: string[] = [];
  if (intro != null) parts.push(`intro=${intro.toFixed(1)}`);
  if (eom != null) parts.push(`eom=${eom.toFixed(1)}`);
  if (extraMeta) {
    for (const [k, v] of Object.entries(extraMeta)) {
      if (v == null || v === "") continue;
      parts.push(`${sanitizeTitleToAscii(k)}=${String(v)}`);
    }
  }
  const meta = parts.length ? `__{${parts.join(",")}}` : "";
  return `${safeCat}/${safeTitle}__${externalId}${meta}.${ext}`;
}

function fmtTimestamp(ts?: number) {
  const d = ts ? new Date(ts) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}${m}${day}_${hh}${mm}`;
}

export function buildExportFilename(input: {
  category?: string;
  subcategory?: string;
  tags?: string[];
  title?: string;
  id?: string;
  createdAt?: number;
  ext?: string;
}) {
  const safeCat = sanitizeTitleToAscii(input.category || "Other");
  const safeSub = input.subcategory ? sanitizeTitleToAscii(input.subcategory) : "";
  const safeTitle = sanitizeTitleToAscii(input.title || input.id || "Recording");
  const ext = (input.ext || "m4a").toLowerCase();
  const ts = fmtTimestamp(input.createdAt);
  let tagsPart = "";
  if (Array.isArray(input.tags) && input.tags.length) {
    const safeTags = input.tags.map((t) => sanitizeTitleToAscii(t)).filter(Boolean).slice(0, 3);
    if (safeTags.length) tagsPart = safeTags.join("-");
  }
  const left = [safeCat, safeSub, tagsPart].filter(Boolean).join("_");
  return `${left ? left + "__" : ""}${safeTitle}__${ts}.${ext}`;
}
