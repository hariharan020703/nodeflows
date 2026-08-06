# Connector Specification: SharePoint

## Overview
Connector to Microsoft SharePoint Online document libraries used as the repository for SOPs, equipment manuals, OEM documentation, inspection checklists, RCA reports, and maintenance photo/video attachments. Provides both retrieval (for grounding AI answers in approved documents) and write-back (for publishing generated reports).

## Reusability Scope
Canonical connector reusable across every manufacturing department for document-grounded AI (Maintenance, Quality SOP retrieval, EHS policy lookup, Training material access).

## Authentication & Security
- **Protocol:** Microsoft Graph API (`/sites/{site-id}/drives`, `/search/query`) over OAuth 2.0.
- **Auth method:** Azure AD app registration with delegated or application permissions (`Sites.Read.All` for retrieval, `Sites.ReadWrite.All` scoped to a specific document library for write-back), certificate-based client credential flow.
- **Authorization:** Access constrained to designated SharePoint sites (e.g., `/sites/PlantA-Maintenance`) via SharePoint site-collection permission scoping — the connector cannot enumerate sites outside its granted scope.
- **Content sensitivity:** Respects existing SharePoint sensitivity labels and Microsoft Purview DLP policies; the AI agent inherits the requesting user's effective read permissions where delegated auth is used.

## Core Data Objects
| Object | Description | Key Metadata |
|---|---|---|
| SOP Library | Standard operating procedures, PM checklists | Title, EquipmentType, Version, ApprovedBy, EffectiveDate |
| OEM Manuals | Vendor equipment manuals | EquipmentModel, Manufacturer, DocType |
| RCA Reports | Historical root cause analysis reports | IncidentID, Equipment, RootCause, Date |
| Photo/Video Attachments | Maintenance evidence media | WorkOrderRef, CapturedBy, Timestamp |

## Integration Pattern
- **Read:** Microsoft Graph Search API for semantic/full-text lookup, combined with a vector index (embeddings refreshed on document change webhook) for RAG-style retrieval by AI skills.
- **Write:** Graph API file upload (`PUT /drives/{id}/root:/path:/content`) for publishing generated reports/checklists into an "AI-Generated" subfolder, always tagged with an `AI-Generated` metadata column and requiring the pattern of human review before moving into the approved SOP library.
- **Change notification:** Graph webhooks subscribe to document library changes to trigger re-indexing of the RAG vector store.

## Latency & Refresh
- Search/retrieval: 1–3 seconds. Vector index refresh: within 15 minutes of a document change webhook firing.

## Error Handling
- Throttling (HTTP 429) handled via `Retry-After` header compliance.
- Failed uploads retried up to 3 times; on persistent failure, the report is attached directly to the requesting Teams/Outlook notification as a fallback delivery channel.

## Sample Query
```
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drive/root:/SOPs/Pumps:/children
```

## Use in This Use Case

The Maintenance Documentation & Work Order Assistant uses SharePoint both as a grounding source for generation quality and as the permanent archive for generated documents and their source evidence:

- **SOP Library / OEM Manuals (read, RAG):** The Report Writer and Work Order Generator skills retrieve relevant SOP sections and OEM manual excerpts for the identified equipment (e.g., pump bearing replacement procedure, gearbox seal replacement spec) to ground failure-mode terminology and repair-action language in approved plant documentation rather than generic phrasing.
- **RCA Reports (read, RAG):** The Report Writer skill optionally retrieves historical RCA reports for the same equipment to note recurring-failure context in a completion report's root-cause narrative, without duplicating the independent diagnostic function of the Breakdown Root Cause Analysis Copilot use case.
- **Photo/Video Attachments (write):** Every repair/damage photo submitted by a technician, along with its vision-language assessment result, is archived to the equipment's `WorkOrderRef`-tagged folder, giving the completion report and any future audit a permanent, linked evidence trail.
- **AI-Generated subfolder (write):** Approved completion reports, repair completion certificates, and shift handover summaries are uploaded to a plant-specific `AI-Generated` subfolder (e.g., `/sites/PlantA-Maintenance/AI-Generated/WorkOrders/`), tagged with the `AI-Generated` metadata column and the source `work_order_ref`, satisfying Business Requirements FR-13.
- **Fallback delivery:** Per the canonical error-handling pattern, if a SharePoint upload fails persistently, the generated report is attached directly to the corresponding Outlook/Teams notification so the human reviewer is never left without the finished document, even if archival is temporarily delayed.
