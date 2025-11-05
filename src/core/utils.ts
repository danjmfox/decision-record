export function generateId(domain: string, slug: string): string {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `DR--${today}--${domain}--${slug}`;
}

export function extractDomainFromId(id: string): string | null {
  const parts = id.split("--");
  if (parts.length < 4) return null;
  const domain = parts[2];
  return typeof domain === "string" && domain.length > 0 ? domain : null;
}
