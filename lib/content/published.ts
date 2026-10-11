// ─────────────────────────────────────────────────────────────
// Publicerade inlägg — ren logik för published_posts.
//
// Appen vet inte själv om något publicerats. En rad här betyder att
// företagaren markerat det, med den text som kopierades ut. Ingenting
// annat i appen får påstå att ett inlägg är publicerat.
// ─────────────────────────────────────────────────────────────

export const CHANNELS = ["facebook", "instagram"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
};

export interface PublishedRow {
  id: string;
  item_key: string;
  channel: Channel;
  published_on: string;
}

export const isChannel = (v: unknown): v is Channel =>
  typeof v === "string" && (CHANNELS as readonly string[]).includes(v);

/** Radens nyckel i sidans uppslag. */
export const pubKey = (itemKey: string, channel: Channel) => `${itemKey}|${channel}`;

/** Rader ur databasen → uppslag. Rader med okänd kanal eller fel form
 *  hoppas över i stället för att krascha sidan. */
export function indexPublished(rows: unknown): Record<string, PublishedRow> {
  const out: Record<string, PublishedRow> = {};
  if (!Array.isArray(rows)) return out;
  for (const r of rows as Array<Record<string, unknown>>) {
    if (!r || typeof r.id !== "string" || typeof r.item_key !== "string") continue;
    if (!isChannel(r.channel) || typeof r.published_on !== "string") continue;
    out[pubKey(r.item_key, r.channel)] = {
      id: r.id, item_key: r.item_key, channel: r.channel, published_on: r.published_on,
    };
  }
  return out;
}

/** Kanalerna ett inlägg är markerat publicerat på, i fast ordning. */
export function publishedChannels(index: Record<string, PublishedRow>, itemKey: string): Channel[] {
  return CHANNELS.filter((c) => Boolean(index[pubKey(itemKey, c)]));
}

/** Hur många av inläggen som inte är publicerade någonstans än. */
export function unpublishedCount(index: Record<string, PublishedRow>, itemKeys: string[]): number {
  return itemKeys.filter((k) => publishedChannels(index, k).length === 0).length;
}

/** "12 okt". Datumet är en kalenderdag, så det formateras i UTC för att
 *  inte glida en dag i någon tidszon. */
export function shortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
}
