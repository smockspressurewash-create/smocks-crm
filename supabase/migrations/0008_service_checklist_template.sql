-- FEATURE 4 — reorderable checklist items linked to a Service (Settings →
-- Services), combined automatically onto a job's checklist/preChecklist when
-- an estimate/job has multiple services selected (see buildChecklistFromServices
-- in src/lib/utils.ts). Also adds serviceId to line items so a job created
-- from an estimate can trace each line item back to the service it came from.
ALTER TABLE services ADD COLUMN IF NOT EXISTS "checklistTemplate" JSONB;
