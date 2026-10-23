# Template port queue

Changes made in CrewBoss that should also go into the generic template (`F0rger123/crm-starter`). Add one line per change (date, commit, what). A session with access to both repos ports them and deletes the line.
- 2026-10-23 · customer import reads .xlsx/.vcf/.json, recognizes columns by their values, headerless files, birthday field, "import as customers / leads / status column" choice (lib/customerImport.ts, lib/spreadsheetFile.ts, ImportDataModal, CustomersPage, Lead Intake bulk move/delete)
- 2026-10-23 · owner_records + useCloudCollection: campaigns/goals/vehicles/maintenance/expenses/accountability/wins sync across devices (migration 0103)
- 2026-10-23 · Jobs: owner day clock bar (OwnerShiftBar), tap card to open, work details only on the owner's active job; Inbox customer-file pop-up; vehicle fields + problem log + delete; Accountability redesign (no meditation); work order delete
