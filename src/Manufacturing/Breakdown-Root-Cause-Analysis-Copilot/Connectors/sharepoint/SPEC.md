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

SharePoint plays a dual role in the Breakdown Investigation Copilot: it is both the **grounding knowledge base** (SOPs, manuals, historical RCA reports) consumed by Knowledge Base Search and Failure Pattern Matcher, and the **publication target** for the final, engineer-approved RCA report.

- **Read for grounding:** Knowledge Base Search queries the `/sites/PlantA-Maintenance/SOPs/Pumps` library for content matching Equipment `10004521`'s type/model (e.g., `SOP-PM-0417: Centrifugal Pump Bearing Inspection & Lubrication`), and the `RCA Reports` library for the historical vector index Failure Pattern Matcher queries against — including the prior `RCA-2026-0507-EQ10004521` report used in the running example throughout this use case's Skills docs.
- **Vector index scope:** Every historical RCA report and SOP in the designated libraries is embedded and indexed; the index is re-indexed within 15 minutes of a document change webhook firing, satisfying NFR-8.
- **Write for publication:** After engineer approval, the Corrective Action Generator's final RCA report is uploaded to `/sites/PlantA-Maintenance/RCA Reports/AI-Generated/` tagged with `IncidentID`, `Equipment`, and `RootCauseCategory` metadata columns, marked `AI-Generated = true`, and made available immediately to future Failure Pattern Matcher queries (closing the loop described in FR-14).
- **Fields consumed/written specifically:** Read — `Title`, `EquipmentType`, `Version`, `EffectiveDate` (SOPs); `IncidentID`, `Equipment`, `RootCause`, `Date` (RCA Reports). Write — new RCA Report document plus the same metadata columns, populated by the Copilot at publish time.
