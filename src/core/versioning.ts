export type VersionBump = "patch" | "minor" | "major";

export function bumpVersion(version: string, bump: VersionBump): string {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  while (parts.length < 3) {
    parts.push(0);
  }
  const [major, minor, patch] = parts;

  if ([major, minor, patch].some((num) => Number.isNaN(num))) {
    throw new Error(`Invalid semantic version supplied: "${version}"`);
  }

  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}
