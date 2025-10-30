export function generateId(domain: string, slug: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `DR--${today}--${domain}--${slug}`;
}
