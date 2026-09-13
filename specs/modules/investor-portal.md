# Module · Investor portal and data room

**Purpose** Answer investor questions with sourced numbers and controlled documents.
**Users** investors, Sigve, advisers.

## Features
- Access request → admin approval → NDA e-sign (BankID) → role `investor`
- Data room: folders, versions, watermarked PDFs, download log
- Financial model in-app (scenario explorer: price, subsidy, PV, battery, V2H share) + xlsx download
- Updates feed and Q&A (questions answered once, visible to all investors)
- Demand signal: registrations and reservations, updated live (admin-approved figures)
- ESG panel: CO₂ avoided, self-sufficiency, trees kept vs cleared (from `trees.json`), local energy share

## Data
`document`, `assumption`, contract `investor.*`, `lead` aggregates.

## 3D integration
Proof slider and living field embedded as evidence; a "site tour" preset sequence of cameras.

## Acceptance
- No investor sees a document without NDA on file
- Scenario outputs equal the xlsx for the base case (unit test)
- Audit log for every download
