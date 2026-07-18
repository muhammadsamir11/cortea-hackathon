import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadDocs } from "../lib/dossier";

export default defineTool({
  description:
    "Inventory of every source document in the dossier: id, filename, kind, document type, and a one-line summary. Use it to orient before searching.",
  inputSchema: z.object({ dossier: z.string().regex(/^[a-z0-9_-]+$/i) }),
  async execute({ dossier }) {
    return loadDocs(dossier).map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      kind: doc.kind,
      docType: doc.docType,
      summary: doc.summary,
    }));
  },
});
