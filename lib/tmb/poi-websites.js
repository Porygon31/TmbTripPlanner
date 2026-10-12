/** @param {unknown} value @returns {string | undefined} */
export function safeWebsiteUrl(value) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!/^https?:\/\//i.test(text) || /[\u0000-\u0020\u007f]/.test(text)) return undefined;
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** @param {string} type @param {Record<string, string | undefined>} tags @returns {string | undefined} */
export function lodgingWebsite(type, tags) {
  if (type !== "hotel" && type !== "refuge") return undefined;
  return safeWebsiteUrl(tags.website) ?? safeWebsiteUrl(tags["contact:website"]);
}
