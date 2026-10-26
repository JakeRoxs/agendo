/** Compare dotted component versions; missing values are not proof of an update. */
export function compareVersions(a?: string, b?: string): number {
  if (!a) return b ? -1 : 0;
  if (!b) return 1;
  const [leftCore, leftPre] = a.split("+")[0].split(/-(.*)/s);
  const [rightCore, rightPre] = b.split("+")[0].split(/-(.*)/s);
  const left = leftCore.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const right = rightCore.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference;
  }
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
    const ln = /^\d+$/.test(l);
    const rn = /^\d+$/.test(r);
    if (ln && rn) return Number(l) - Number(r);
    if (ln !== rn) return ln ? -1 : 1;
    return l < r ? -1 : 1;
  }
  return 0;
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
    const base = sourceUrl.replace(/\/+$/, "");
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
