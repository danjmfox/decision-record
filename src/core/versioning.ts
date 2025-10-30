export function bumpVersion(version: string, major = false): string {
  const [majorPart, minorPart] = version.split(".");
  const maj = Number.parseInt(majorPart ?? "0", 10);
  const min = Number.parseInt(minorPart ?? "0", 10);

  if (Number.isNaN(maj) || Number.isNaN(min)) {
    throw new Error(`Invalid semantic version supplied: "${version}"`);
  }

  return major ? `${maj + 1}.0` : `${maj}.${min + 1}`;
}
