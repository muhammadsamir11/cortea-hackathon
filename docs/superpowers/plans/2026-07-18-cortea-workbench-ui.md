# Cortea Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Cortea audit chrome with shadcn Sidebar/Resizable and polish Report, Graph, Documents, and Ask evenly using new shadcn primitives.

**Architecture:** Add missing components to `@almedia/ui`, then rebuild `Workspace` shell (Sidebar + tab content + Evidence Sheet). Report uses Resizable list|detail; other tabs swap ad-hoc controls for Select/Input Group/Empty/Alert/Sonner while preserving review shortcuts and export.

**Tech Stack:** Next.js App Router · `@almedia/ui` (shadcn radix-rhea) · Tailwind v4 · lucide-react · React Flow (graph)

## Global Constraints

- Honor locked `design.md` (Workbench · evidence-emerald · Inter · no app enrichment)
- Preserve `j/k` and `c/x/i` review shortcuts and markdown export
- No engine/API/data-model changes; home stays redirect to `/audit`
- No celebratory toasts; Sonner for Ask failures only
- Mobile: Sidebar collapses; Report list→detail + Back; no horizontal scroll
- Do not commit unless user asks

---

### Task 1: Add shadcn components to `@almedia/ui`

**Files:**
- Create: `packages/ui/src/components/{sidebar,select,separator,kbd,input-group,resizable,command,alert-dialog,skeleton,sonner,button-group,spinner,item,dialog,popover,label}.tsx` (CLI may add helpers)
- Modify: `packages/ui/package.json` if peer deps added

- [x] **Step 1:** From `packages/ui`, run shadcn add for required components (non-interactive)
- [x] **Step 2:** Verify exports resolve via `@almedia/ui/components/*`
- [x] **Step 3:** Add `Toaster` to `apps/web/src/components/providers.tsx`

**Done when:** App imports new components without type errors.

---

### Task 2: Workspace shell — Sidebar + header polish

**Files:**
- Create: `apps/web/src/app/audit/_components/app-sidebar.tsx`
- Modify: `apps/web/src/app/audit/_components/workspace.tsx`
- Modify: `apps/web/src/components/header.tsx` (SidebarTrigger if needed)
- Modify: `apps/web/src/components/providers.tsx` (SidebarProvider optional at workspace level)

- [ ] **Step 1:** Extract nav into `AppSidebar` with Report/Graph/Documents/Ask + materiality footer
- [ ] **Step 2:** Replace vertical Tabs rail with Sidebar; keep TabsContent or equivalent state for panes
- [ ] **Step 3:** Header slot: Select/Command dossier switcher, Separator meters, Tooltip on integrity Badge, Alert banner
- [ ] **Step 4:** Keep Evidence Sheet unchanged in behavior

**Done when:** All four tabs reachable via Sidebar; dossier switch and export still work.

---

### Task 3: Report tab — Resizable + decisions UX

**Files:**
- Modify: `report-tab.tsx`, `finding-list.tsx`, `finding-detail.tsx`

- [ ] **Step 1:** Desktop list|detail → `ResizablePanelGroup`
- [ ] **Step 2:** Decision buttons → Button Group + Kbd; reset → Alert Dialog
- [ ] **Step 3:** Meter strip Separators; Empty states unchanged in copy

**Done when:** Resize works on lg+; shortcuts still work; reset confirms.

---

### Task 4: Graph token restyle + Empty

**Files:**
- Modify: `money-graph.tsx`

- [ ] **Step 1:** Replace hard-coded zinc/emerald/red node classes with design tokens
- [ ] **Step 2:** Inspector Empty for no selection; ScrollArea retained

**Done when:** Graph readable in light/dark using Cortea tokens.

---

### Task 5: Documents — Select + Input Group

**Files:**
- Modify: `documents-tab.tsx`

- [ ] **Step 1:** Native select → Select; search → Input Group
- [ ] **Step 2:** Empty when no matches; accent links use `text-clear`

**Done when:** Filter/search work; no native `<select>`.

---

### Task 6: Ask — Empty/Alert/Input Group/Sonner

**Files:**
- Modify: `chat-tab.tsx`

- [ ] **Step 1:** Unavailable → Empty + Alert
- [ ] **Step 2:** Composer → Input Group; Spinner while busy
- [ ] **Step 3:** toast.error on send failure only

**Done when:** Ask states match design system voice.

---

### Task 7: Empty dossier page + visual QA

**Files:**
- Modify: `apps/web/src/app/audit/page.tsx`

- [ ] **Step 1:** Align empty-dossier Card with workbench spacing/type
- [ ] **Step 2:** Manual check at narrow/wide widths; `pnpm --filter web check-types`

**Done when:** Typecheck passes; shell usable on mobile and desktop.
