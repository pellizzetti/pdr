// bun run jira-export.ts 2025-01-01 2025-06-30 --project ABC,DEF --out ./output/

type IssueRow = {
  key: string;
  summary: string;
  status: string;
  type: string;
  assignee: string;
  reporter: string;
  priority: string;
  created: string;
  updated: string;
  resolutiondate: string;
  project: string;
  points: number | null;
  url: string;
};

const { JIRA_SITE_URL, JIRA_EMAIL, JIRA_TOKEN } = process.env;
if (!JIRA_SITE_URL || !JIRA_EMAIL || !JIRA_TOKEN) {
  console.error("Defina JIRA_SITE_URL, JIRA_EMAIL e JIRA_TOKEN no .env");
  process.exit(1);
}

function parseArgs() {
  const [, , fromISO, toISO, ...rest] = process.argv;
  if (!fromISO || !toISO) {
    console.log("Uso: bun run jira-export.ts 2025-01-01 2025-06-30 [--project ABC,DEF] [--out ./output/]");
    process.exit(1);
  }
  let projects: string[] | undefined;
  let outputDir = "./";
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--project") {
      projects = (rest[i + 1] || "").split(",").map((s) => s.trim()).filter(Boolean);
      i++;
    } else if (rest[i] === "--out") {
      outputDir = rest[i + 1] || "./";
      i++;
    }
  }
  return { fromISO, toISO, projects, outputDir };
}

function buildJql(fromISO: string, toISO: string, projects?: string[]) {
  const from = fromISO.split("T")[0];
  const to = toISO.split("T")[0];
  const datePart = `((updated >= "${from}" AND updated <= "${to}") OR (resolutiondate >= "${from}" AND resolutiondate <= "${to}"))`;
  const projPart = projects && projects.length ? `project IN (${projects.map((p) => `"${p}"`).join(",")}) AND ` : "";
  return `${projPart}${datePart} ORDER BY updated DESC`;
}

async function getJSON<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function postJSON<T>(url: string, body: any, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

function basicAuthHeader() {
  const token = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function searchIssues(site: string, jql: string): Promise<IssueRow[]> {
  const base = `${site}/rest/api/3/search`;
  const fields = [
    "key","summary","status","issuetype","assignee","reporter",
    "priority","created","updated","resolutiondate","project","customfield_10016",
  ];
  const headers = basicAuthHeader();

  let startAt = 0;
  const maxResults = 100;
  const rows: IssueRow[] = [];

  while (true) {
    const data = await postJSON<any>(
      base,
      { jql, startAt, maxResults, fields, expand: [] },
      headers
    );

    for (const i of data.issues ?? []) {
      rows.push({
        key: i.key,
        summary: i.fields?.summary,
        status: i.fields?.status?.name,
        type: i.fields?.issuetype?.name,
        assignee: i.fields?.assignee?.displayName || "",
        reporter: i.fields?.reporter?.displayName || "",
        priority: i.fields?.priority?.name || "",
        created: i.fields?.created,
        updated: i.fields?.updated,
        resolutiondate: i.fields?.resolutiondate || "",
        project: i.fields?.project?.key || "",
        points: i.fields?.customfield_10016 || null,
        url: `${JIRA_SITE_URL}/browse/${i.key}`,
      });
    }

    startAt += data.issues?.length ?? 0;
    if (startAt >= (data.total ?? 0) || (data.issues?.length ?? 0) === 0) break;
  }
  return rows;
}

function toCSV(rows: IssueRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc((r as any)[h])).join(","));
  return lines.join("\n");
}

async function main() {
  const { fromISO, toISO, projects, outputDir } = parseArgs();
  const jql = buildJql(fromISO, toISO, projects);
  console.log("JQL =>", jql);

  const data = await searchIssues(JIRA_SITE_URL!, jql);
  
  // Ensure output directory ends with /
  const outDir = outputDir.endsWith("/") ? outputDir : outputDir + "/";
  const jsonPath = `${outDir}jira-issues.json`;
  const csvPath = `${outDir}jira-issues.csv`;
  
  await Bun.write(jsonPath, JSON.stringify(data, null, 2));
  await Bun.write(csvPath, toCSV(data));
  console.log(`OK! ${data.length} issues salvas em ${jsonPath} e ${csvPath}`);
}

main().catch((e) => {
  console.error("Erro:", e?.message || e);
  process.exit(1);
});
