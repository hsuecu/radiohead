export type RssItem = {
  title: string;
  link: string;
  pubDate?: string;
  source?: string;
  image?: string | null;
  domain?: string | null;
  tags?: string[];
};

export function timeAgo(dateString?: string): string {
  if (!dateString) return "";
  const t = new Date(dateString).getTime();
  if (isNaN(t)) return "";
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function extract(tag: string, block: string): string | undefined {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = re.exec(block);
  return m?.[1]?.trim();
}

function extractCdata(tag: string, block: string): string | undefined {
  const re = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const m = re.exec(block);
  return m?.[1]?.trim();
}

function extractImage(block: string): string | null {
  // media:content or media:thumbnail url
  const media = /<media:content[^>]*url=\"([^\"]+)\"/i.exec(block) || /<media:thumbnail[^>]*url=\"([^\"]+)\"/i.exec(block);
  if (media?.[1]) return media[1];
  // media:group thumbnail
  const group = /<media:group>[\s\S]*?<media:thumbnail[^>]*url=\"([^\"]+)\"/i.exec(block);
  if (group?.[1]) return group[1];
  // enclosure url
  const enc = /<enclosure[^>]*url=\"([^\"]+)\"/i.exec(block);
  if (enc?.[1]) return enc[1];
  // img in description or content:encoded
  const desc = extract("description", block) || extractCdata("description", block) || extractCdata("content:encoded", block) || "";
  const img = /<img[^>]*src=\"([^\"]+)\"/i.exec(desc);
  return img?.[1] || null;
}

function normalizeLink(link: string): string {
  try {
    if (!link) return link;
    if (link.includes("url=")) {
      const idx = link.indexOf("url=");
      const part = link.slice(idx + 4);
      const amp = part.indexOf("&");
      const raw = amp >= 0 ? part.slice(0, amp) : part;
      return decodeURIComponent(raw);
    }
    const u = new URL(link);
    // Google News redirect domains
    if (u.hostname.includes("news.google")) {
      const target = u.searchParams.get("url");
      if (target) return decodeURIComponent(target);
    }
    return link;
  } catch { return link; }
}

function extractDomain(link: string): string | null {
  try {
    const u = new URL(link);
    const h = u.hostname.replace(/^www\./, "");
    return h || null;
  } catch { return null; }
}

export async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url);
  const xml = await res.text();
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml))) {
    const block = m[1];
    const title = extractCdata("title", block) || extract("title", block) || "";
    const rawLink = extract("link", block) || "";
    const link = normalizeLink(rawLink);
    const pubDate = extract("pubDate", block);
    const source = extract("source", block);
    const image = extractImage(block);
    if (title && link) {
      const domain = extractDomain(link);
      const lc = title.toLowerCase();
      const tags: string[] = [];
      if (lc.includes("video") || /\bwatch\b/.test(lc)) tags.push("Video");
      if (lc.includes("analysis")) tags.push("Analysis");
      if (lc.includes("explainer")) tags.push("Explainer");
      items.push({ title, link, pubDate, source, image, domain, tags });
    }
  }
  return items;
}

export function isVideo(it: RssItem): boolean {
  const t = it.title.toLowerCase();
  return t.includes("video") || /\bwatch\b/.test(t);
}

export function isAnalysis(it: RssItem): boolean {
  const t = it.title.toLowerCase();
  return t.includes("analysis") || t.includes("explainer");
}
