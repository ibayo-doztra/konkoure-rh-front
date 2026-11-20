/**
 * Employee import template (XLSX). The file is analysed and imported by the API
 * (POST /org/employees/import/preview then /commit, 06 §4): only the template
 * is built here. The API reads the first worksheet and accepts these French
 * headers, or their English equivalents.
 */

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export interface DeptOption {
  id: string;
  name: string;
}

const COLUMNS = [
  { header: "Matricule", width: 14 },
  { header: "Nom", width: 18 },
  { header: "Prénom", width: 18 },
  { header: "E-mail", width: 30 },
  { header: "Téléphone", width: 18 },
  { header: "Poste", width: 26 },
  { header: "Département", width: 24 },
  { header: "Manager", width: 24 },
  { header: "Date d'embauche", width: 18 },
  { header: "Date de naissance", width: 18 },
] as const;

/** Rows given a department drop-down and a date format in the template. */
const FORMATTED_ROWS = 500;

/** Builds the XLSX template and downloads it. */
export async function downloadTemplate(departments: DeptOption[], orgName?: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Konkouré RH";
  wb.created = new Date();

  // First sheet: the only one the API reads. It holds headers only, so that
  // nothing from the template is imported by mistake.
  const ws = wb.addWorksheet("Employés");
  ws.columns = COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F7A4D" } };
  });
  for (let r = 2; r <= FORMATTED_ROWS + 1; r++) {
    ws.getCell(`I${r}`).numFmt = "dd/mm/yyyy";
    ws.getCell(`J${r}`).numFmt = "dd/mm/yyyy";
    if (departments.length > 0) {
      ws.getCell(`G${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Listes!$A$2:$A$${departments.length + 1}`],
        showErrorMessage: true,
        errorTitle: "Département inconnu",
        error: "Choisissez un département existant dans la liste.",
      };
    }
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const example = wb.addWorksheet("Exemple");
  example.columns = COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  example.getRow(1).font = { bold: true };
  example.addRow([
    "EMP-001",
    "Diallo",
    "Mariama",
    "mariama.diallo@exemple.gn",
    "622 12 34 56",
    "Chargée de clientèle",
    departments[0]?.name ?? "Ressources humaines",
    "Mamadou Camara",
    "01/03/2026",
    "15/06/1992",
  ]);

  const lists = wb.addWorksheet("Listes");
  lists.columns = [{ header: "Départements", width: 30 }];
  lists.getRow(1).font = { bold: true };
  departments.forEach((d) => lists.addRow([d.name]));

  const info = wb.addWorksheet("Instructions");
  info.columns = [{ header: "Instructions", width: 110 }];
  info.getRow(1).font = { bold: true, size: 12 };
  [
    orgName ? `Organisation : ${orgName}` : "",
    "Remplissez une ligne par employé dans l'onglet « Employés », à partir de la ligne 2. Seul cet onglet est importé.",
    "« Nom » et « Prénom » sont obligatoires ; les autres colonnes sont facultatives.",
    "Une ligne dont le matricule (sinon l'e-mail) existe déjà met à jour la fiche avec ses seules cellules remplies.",
    "Département : nom exact d'un département existant. Manager : « Prénom Nom » d'un employé.",
    "Dates au format JJ/MM/AAAA ou AAAA-MM-JJ.",
    `Au plus ${IMPORT_MAX_ROWS} lignes et 5 Mo par fichier. Le format CSV (séparateur ; ou ,) est aussi accepté.`,
    "L'onglet « Exemple » montre une ligne remplie.",
  ]
    .filter(Boolean)
    .forEach((line) => info.addRow([line]));

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
