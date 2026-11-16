/**
 * Importation en masse des employés — génération du modèle XLSX,
 * lecture et validation du fichier rempli. Logique pure (aucune UI).
 */

export const IMPORT_MAX_ROWS = 500;

export const IMPORT_HEADERS = [
  "Prénom",
  "Nom",
  "Email",
  "Téléphone",
  "Poste",
  "Département",
  "Date d'embauche",
  "Statut",
] as const;

export const STATUS_LABELS: Record<string, "active" | "on_leave" | "terminated"> = {
  actif: "active",
  active: "active",
  "en conge": "on_leave",
  "en congé": "on_leave",
  on_leave: "on_leave",
  sorti: "terminated",
  sortie: "terminated",
  terminated: "terminated",
};

export interface DeptOption { id: string; name: string }

export interface ParsedRow {
  line: number;
  raw: Record<string, string>;
  valid: boolean;
  errors: string[];
  payload?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    job_title: string;
    department_id: string;
    status: "active" | "on_leave" | "terminated";
    hire_date: string;
  };
}

function normalize(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Convertit une valeur de cellule (texte ou date Excel) en AAAA-MM-JJ. */
export function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const o = value as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("").trim();
    if (typeof o.text === "string") return o.text.trim();
    if (o.result != null) return String(o.result).trim();
  }
  return String(value).trim();
}

/** Valide une ligne brute et construit le payload d'insertion. */
export function validateRow(
  raw: Record<string, string>,
  line: number,
  ctx: { deptByName: Map<string, string>; existingEmails: Set<string>; seenEmails: Set<string> },
): ParsedRow {
  const errors: string[] = [];
  const first_name = raw["Prénom"] ?? "";
  const last_name = raw["Nom"] ?? "";
  const email = (raw["Email"] ?? "").toLowerCase();
  const phone = raw["Téléphone"] ?? "";
  const job_title = raw["Poste"] ?? "";
  const deptName = raw["Département"] ?? "";
  const hireRaw = raw["Date d'embauche"] ?? "";
  const statusRaw = raw["Statut"] ?? "";

  if (!first_name) errors.push("Prénom manquant");
  else if (first_name.length > 80) errors.push("Prénom trop long");
  if (!last_name) errors.push("Nom manquant");
  else if (last_name.length > 80) errors.push("Nom trop long");

  if (!email) errors.push("Email manquant");
  else if (!EMAIL_RE.test(email)) errors.push("Email invalide");
  else if (ctx.existingEmails.has(email)) errors.push("Email déjà présent dans l'organisation");
  else if (ctx.seenEmails.has(email)) errors.push("Email en doublon dans le fichier");

  if (!phone) errors.push("Téléphone manquant");
  else if (phone.length < 6) errors.push("Téléphone trop court");
  else if (phone.length > 30) errors.push("Téléphone trop long");

  if (!job_title) errors.push("Poste manquant");
  else if (job_title.length > 120) errors.push("Poste trop long");

  let department_id = "";
  if (!deptName) errors.push("Département manquant");
  else {
    const found = ctx.deptByName.get(normalize(deptName));
    if (!found) errors.push(`Département inconnu : « ${deptName} »`);
    else department_id = found;
  }

  const hire_date = toIsoDate(hireRaw);
  if (!hireRaw) errors.push("Date d'embauche manquante");
  else if (!hire_date) errors.push("Date d'embauche illisible (JJ/MM/AAAA attendu)");

  let status: "active" | "on_leave" | "terminated" = "active";
  if (statusRaw) {
    const mapped = STATUS_LABELS[normalize(statusRaw)];
    if (!mapped) errors.push(`Statut inconnu : « ${statusRaw} »`);
    else status = mapped;
  }

  if (errors.length === 0) ctx.seenEmails.add(email);

  return {
    line,
    raw,
    valid: errors.length === 0,
    errors,
    payload:
      errors.length === 0
        ? { first_name, last_name, email, phone, job_title, department_id, status, hire_date: hire_date! }
        : undefined,
  };
}

/** Lit un fichier XLSX rempli et retourne les lignes validées. */
export async function parseWorkbook(
  file: File,
  ctx: { departments: DeptOption[]; existingEmails: string[] },
): Promise<{ rows: ParsedRow[]; truncated: boolean }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Le fichier ne contient aucune feuille.");

  const headerRow = ws.getRow(1);
  const colIndex = new Map<string, number>();
  headerRow.eachCell((cell, col) => {
    const label = cellText(cell.value);
    const match = IMPORT_HEADERS.find((h) => normalize(h) === normalize(label));
    if (match) colIndex.set(match, col);
  });

  const missing = IMPORT_HEADERS.filter((h) => h !== "Statut" && !colIndex.has(h));
  if (missing.length) throw new Error(`Colonnes manquantes : ${missing.join(", ")}`);

  const deptByName = new Map(ctx.departments.map((d) => [normalize(d.name), d.id]));
  const existingEmails = new Set(ctx.existingEmails.map((e) => e.toLowerCase()));
  const seenEmails = new Set<string>();

  const rows: ParsedRow[] = [];
  let truncated = false;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw: Record<string, string> = {};
    for (const h of IMPORT_HEADERS) {
      const c = colIndex.get(h);
      raw[h] = c ? cellText(row.getCell(c).value) : "";
    }
    // Ligne vide -> ignorée
    if (IMPORT_HEADERS.every((h) => !raw[h])) continue;
    if (rows.length >= IMPORT_MAX_ROWS) { truncated = true; break; }
    // Les dates doivent conserver leur type natif
    const dateCol = colIndex.get("Date d'embauche");
    if (dateCol) {
      const v = row.getCell(dateCol).value;
      if (v instanceof Date) raw["Date d'embauche"] = toIsoDate(v) ?? "";
    }
    rows.push(validateRow(raw, r, { deptByName, existingEmails, seenEmails }));
  }

  return { rows, truncated };
}

/** Génère le modèle XLSX à remplir et le télécharge. */
export async function downloadTemplate(departments: DeptOption[], orgName?: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Konkouré RH";
  wb.created = new Date();

  const ws = wb.addWorksheet("Employés");
  ws.columns = [
    { header: "Prénom", key: "first_name", width: 18 },
    { header: "Nom", key: "last_name", width: 18 },
    { header: "Email", key: "email", width: 30 },
    { header: "Téléphone", key: "phone", width: 20 },
    { header: "Poste", key: "job_title", width: 26 },
    { header: "Département", key: "department", width: 24 },
    { header: "Date d'embauche", key: "hire_date", width: 18 },
    { header: "Statut", key: "status", width: 14 },
  ];

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F7A4D" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF14532D" } } };
  });

  ws.addRow({
    first_name: "Mariama",
    last_name: "Diallo",
    email: "mariama.diallo@exemple.gn",
    phone: "+224 620 00 00 00",
    job_title: "Chargée de clientèle",
    department: departments[0]?.name ?? "Ressources Humaines",
    hire_date: "01/03/2026",
    status: "Actif",
  });
  ws.getRow(2).font = { italic: true, color: { argb: "FF6B7280" } };

  const lastRow = 500;
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`H${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Actif,En congé,Sorti"'],
      showErrorMessage: true,
      errorTitle: "Statut invalide",
      error: "Choisissez Actif, En congé ou Sorti.",
    };
    ws.getCell(`G${r}`).numFmt = "dd/mm/yyyy";
    if (departments.length > 0) {
      ws.getCell(`F${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`Listes!$A$2:$A$${departments.length + 1}`],
        showErrorMessage: true,
        errorTitle: "Département inconnu",
        error: "Choisissez un département existant dans la liste.",
      };
    }
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const lists = wb.addWorksheet("Listes");
  lists.columns = [{ header: "Départements", key: "dept", width: 30 }];
  lists.getRow(1).font = { bold: true };
  departments.forEach((d) => lists.addRow({ dept: d.name }));

  const info = wb.addWorksheet("Instructions");
  info.columns = [{ header: "Instructions", key: "txt", width: 110 }];
  info.getRow(1).font = { bold: true, size: 12 };
  const lines = [
    orgName ? `Organisation : ${orgName}` : "",
    "Remplissez une ligne par employé, à partir de la ligne 2 de l'onglet « Employés ».",
    "La ligne 2 est un exemple : remplacez-la ou supprimez-la avant l'import.",
    "Toutes les colonnes sont obligatoires sauf « Statut » (Actif par défaut).",
    "Date d'embauche au format JJ/MM/AAAA.",
    "Le département doit correspondre exactement à un département existant (menu déroulant).",
    "Créez d'abord vos départements dans Konkouré RH si la liste ci-dessous est vide.",
    `Maximum ${IMPORT_MAX_ROWS} lignes par import.`,
    "",
    "Départements disponibles :",
    ...(departments.length ? departments.map((d) => `  • ${d.name}`) : ["  (aucun département — créez-les avant l'import)"]),
  ].filter(Boolean);
  lines.forEach((txt) => info.addRow({ txt }));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele-import-employes.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
