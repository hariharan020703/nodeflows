# Connector Specification: Supplier Portal

> Adapted from the canonical spec at `Shared-Library/Connectors/Supplier-Portal.md`. Any change to authentication, authorization, or core data objects must be reconciled with the canonical version before being adopted here.

## Overview
Connector to the organization's supplier/vendor portal (e.g., Ariba Network, Coupa Supplier Portal, or a custom B2B portal) for real-time vendor lead times, alternative-part cross-references, quotes, and automated procurement request submission for spare parts.

## Reusability Scope
Canonical connector reusable across Maintenance (Spare Parts Intelligence Assistant), Procurement (sourcing and vendor management), and Supply Chain Planning.

## Authentication & Security
- **Protocol:** Vendor-portal REST API (Ariba Network API, Coupa Open API) over OAuth 2.0, or cXML for legacy B2B procurement transactions.
- **Auth method:** OAuth 2.0 client credentials issued by the portal provider, scoped to the organization's buyer account.
- **Authorization:** Read access to catalog/quote/lead-time data; write access limited to submitting request-for-quote (RFQ) and procurement-request documents — final PO issuance remains a procurement-team-approved action in SAP MM/ERP, not this connector.

## Core Data Objects
| Object | Description | Key Fields |
|---|---|---|
| Vendor Catalog Item | Supplier-listed part | VendorPartNo, InternalMaterialXref, Price, MOQ, LeadTimeDays |
| Alternative Part Cross-Reference | Equivalent/substitute parts across vendors | OriginalMaterial, AlternativeMaterial, CompatibilityNotes |
| RFQ | Request for quote submitted to one or more vendors | RFQID, Material, Quantity, RequiredDate, Status |
| Vendor Performance | On-time delivery, quality rejection rate | VendorID, OTIFRate, RejectionRate, RatingScore |

## Integration Pattern
- **Read:** REST GET for current lead time, price, and alternative-part lookups when a spare part is low-stock or unavailable.
- **Write:** RFQ submission via REST POST when the Spare Parts Intelligence Assistant identifies a procurement need; response (quote) ingested asynchronously via webhook or polling.

## Latency & Refresh
- Catalog/lead-time lookups: 2–5 seconds (live vendor API call). RFQ turnaround depends on the vendor (typically hours to days) and is tracked asynchronously, not blocking the AI workflow.

## Error Handling
- Vendor API unavailability falls back to last-cached lead time/price with an "as of" timestamp and a flag recommending manual vendor contact for time-critical parts.
- Multi-vendor RFQ submission logs each vendor's response status independently so a single non-responsive vendor doesn't block the others.

## Sample Payload (RFQ Submission)
```json
{
  "material": "SP-BRG-6205-2RS",
  "quantity": 12,
  "requiredDate": "2026-08-18",
  "vendors": ["VEND-1001", "VEND-1042"],
  "notes": "Urgent — predicted failure on Line 3 conveyor bearings within 7 days"
}
```

## Use in This Use Case

The Supplier Portal connector is the Vendor Recommendation and Spare Recommendation skills' primary external source of truth for anything SAP MM's vendor master does not carry in real time — live price, live lead time, and substitute-part cross-references.

- **Vendor Catalog Item reads** map directly onto `Sample Data/vendor_catalog.csv` (`vendor_id`, `material_id`, `price`, `moq`, `lead_time_days`, `otif_rate`). The Vendor Recommendation skill queries this object for every Class A/B material with more than one qualified vendor (e.g., `SP-BRG-6205-2RS` is available from `VEND-1001`, `VEND-1009`, and `VEND-1004` at different price/lead-time/OTIF combinations) and ranks vendors on a blended score of price, lead time, and OTIF reliability rather than price alone.
- **Alternative Part Cross-Reference reads** back `Sample Data/alt_part_xref.csv` — when the Spare Recommendation skill's embedding-based matcher (see `Technical Design.md`) proposes a candidate substitute part that is not in the internal SAP MM material master (e.g., `VND-SKF-6205-2RSH` as a cross-brand equivalent of `SP-BRG-6205-2RS`), this object supplies the vendor's own compatibility notes and part attributes used to validate the match before it is presented to a planner.
- **RFQ submission** is the connector's sole write action in this use case: when Cost Optimization/Vendor Recommendation jointly determine that a competitive quote is warranted (large-value order, new vendor, or a lapsed price agreement), the plugin submits an RFQ payload structured exactly like the canonical sample above, and the resulting quote is ingested asynchronously and attached to the draft purchase requisition for human review.
- **Guardrail:** RFQ submission never commits spend — it only solicits pricing. Any resulting order still flows through the SAP MM purchase requisition/PO approval chain, and a non-responsive vendor's RFQ never blocks the others from being actioned.
