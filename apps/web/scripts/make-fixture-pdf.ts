// Converts the fixture bank confirmation from .txt to a real PDF so the
// PDF ingestion path (unpdf) and the react-pdf viewer are exercised.
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { dossierDir } from "@almedia/forensic/paths";

async function main() {
  const dir = dossierDir("synthetic");
  const txt = path.join(dir, "bank-confirmation-2024.txt");
  const text = fs.readFileSync(txt, "utf8");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const page = doc.addPage([595, 842]); // A4
  let y = 800;
  for (const line of text.split("\n")) {
    page.drawText(line, { x: 50, y, size: 9, font });
    y -= 14;
    if (y < 40) break;
  }
  fs.writeFileSync(path.join(dir, "bank-confirmation-2024.pdf"), await doc.save());
  fs.unlinkSync(txt);
  console.log("→ bank-confirmation-2024.pdf (txt removed)");
}
main();
