# Reference: Inventory Analyzer

## Reusability Notes

The criticality-weighted safety-stock/reorder-point methodology is a standard inventory-science pattern directly reusable by Procurement (broader MRO inventory optimization beyond maintenance spares) and by Production Planning (raw material/WIP buffer sizing) — only the criticality taxonomy and the carrying-cost rate need to be re-parameterized per department. The overstock/carrying-cost detection logic is equally applicable to any slow-moving inventory category, including finished-goods safety stock.
