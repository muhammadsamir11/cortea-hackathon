// Generates the trial-balance XLSX for the synthetic fixture dossier.
import path from "node:path";
import * as XLSX from "xlsx";
import { dossierDir } from "@almedia/forensic/paths";

const rows = [
  ["Summen- und Saldenliste PayFlux GmbH", "", "", ""],
  ["Stichtag: 31.12.2024", "", "", ""],
  ["Konto", "Bezeichnung", "Soll EUR", "Haben EUR"],
  ["1200", "Bank (Commerzbank Kontokorrent DE55 1004 0000 1234 5678 00)", "512.350,22", ""],
  ["1400", "Forderungen aus Lieferungen und Leistungen", "187.440,10", ""],
  ["1600", "Verbindlichkeiten aus Lieferungen und Leistungen", "", "94.310,45"],
  ["4400", "Umsatzerlöse", "", "2.845.910,00"],
  ["4830", "Sonstige betriebliche Erträge (Lizenzgebühr Meridian)", "", "47.500,00"],
  ["6300", "Sonstige betriebliche Aufwendungen", "391.220,00", ""],
  ["6820", "Miete", "102.000,00", ""],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "SuSa 2024");
const out = path.join(dossierDir("synthetic"), "trial-balance-2024.xlsx");
XLSX.writeFile(wb, out);
console.log(`→ ${out}`);
