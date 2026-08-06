# Connector: SharePoint

*Adapted from the canonical specification at `Shared-Library/Connectors/SharePoint.md`. Content below is consistent with that canonical spec; see this document's "Use in This Use Case" section for how the Predictive Maintenance Assistant specifically uses it.*

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

The Predictive Maintenance Assistant uses SharePoint as its grounding source for retrieval-augmented generation (RAG) and as its RCA knowledge archive:

- **SOP Library** is queried by the SOP Retrieval skill, filtered by `EquipmentType`/`EquipmentModel` metadata and restricted to the current approved `Version`/`EffectiveDate`, returning specific sections (e.g., "SOP-PUMP-014, Section 4.3 - Outer Race Wear Inspection") rather than full documents.
- **RCA Reports** are queried by the Root Cause Analysis skill to retrieve comparable historical incidents (`IncidentID`, `Equipment`, `RootCause`, `Date`), cited directly in the 5-Why causal chain output.
- **OEM Manuals** are queried alongside RCA reports to ground root-cause hypotheses in manufacturer guidance when no directly comparable internal incident exists.
- **Write-back**: the Maintenance Report Writer skill publishes the finalized diagnostic trail (evidence, diagnosis, root cause, resolution) into an `AI-Generated` subfolder of the RCA archive after human approval, per FR-12 in `Business Requirements.md`, strengthening future retrieval for subsequent incidents on the same or similar equipment.
- The vector index is re-indexed within 15 minutes of any SOP or RCA document change, per the canonical spec, ensuring the assistant never operates on a stale procedure after an SOP revision.
