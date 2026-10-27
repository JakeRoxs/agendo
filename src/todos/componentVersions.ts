/** Compare dotted component versions; missing values are not proof of an update. */
export function compareVersions(a?: string, b?: string): number {
  if (!a) return b ? -1 : 0;
  if (!b) return 1;
  const left = splitVersion(a);
  const right = splitVersion(b);
  const coreComparison = compareCore(left.core, right.core);
  if (coreComparison !== 0) return coreComparison;
  return comparePrerelease(left.pre, right.pre);
}

function splitVersion(version: string): { core: string[]; pre: string | undefined } {
  const [coreSegment, pre] = version.split("+")[0].split(/-(.*)/s);
  return { core: coreSegment.split("."), pre };
}

function compareCore(left: string[], right: string[]): number {
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference =
      (Number.parseInt(left[i] ?? "0", 10) || 0) - (Number.parseInt(right[i] ?? "0", 10) || 0);
    if (difference) return difference;
  }
  return 0;
}

function comparePrerelease(leftPre: string | undefined, rightPre: string | undefined): number {
  if (leftPre === rightPre) return 0;
  if (leftPre === undefined) return 1;
  if (rightPre === undefined) return -1;
  const leftParts = leftPre.split(".");
  const rightParts = rightPre.split(".");
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
    if (leftParts[i] === undefined) return -1;
    if (rightParts[i] === undefined) return 1;
    const l = leftParts[i];
    const r = rightParts[i];
    if (l === r) continue;
    return comparePrereleaseIdentifier(l, r);
  }
  return 0;
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left < right ? -1 : 1;
}

export interface SourceVersion {
  sourceUrl?: string;
  sourceVersion?: string;
  sourceError?: string;
}

/** Compare versions only when both are known; a mismatch does not establish origin. */
export function versionRelationship(installed?: string, available?: string): string {
  if (!installed || !available) return "comparison unknown";
  const comparison = compareVersions(installed, available);
  if (comparison > 0) return "installed is newer; differs";
  if (comparison < 0) return "newer version available";
  return installed === available ? "version matches" : "version differs";
}

export async function checkSourceVersion(
  sourceUrl: string,
  metadata: string,
  fetch: (url: string) => Promise<string>,
): Promise<SourceVersion> {
  try {
    let end = sourceUrl.length;
    while (end > 0 && sourceUrl[end - 1] === "/") end--;
    const base = sourceUrl.slice(0, end);
    if (!base) throw new Error("No source URL configured");
    const url = new URL(`${base}/${metadata}`);
    if (url.protocol !== "https:") throw new Error("Source URL must use HTTPS");
    if (url.username || url.password) throw new Error("Source URL must not contain credentials");
    const meta = JSON.parse(await fetch(url.toString()));
    if (
      typeof meta.version !== "string" ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(meta.version)
    ) {
      throw new Error("Source metadata has no valid version");
    }
    return { sourceUrl, sourceVersion: meta.version };
  } catch {
    // Never claim the bundled version is the source version on a failed check.
    return { sourceUrl, sourceError: "Source version unavailable; check the URL and connection" };
  }
}
