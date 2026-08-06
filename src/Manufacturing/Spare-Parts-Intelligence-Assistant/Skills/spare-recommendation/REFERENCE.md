# Reference: Spare Recommendation

## Reusability Notes

The forecasting pattern (consumption history -> cleaned time series -> tiered model selection by data volume/criticality -> LLM-explained recommendation) is directly reusable by any department that manages consumable or MRO inventory against usage history: Production (packaging/consumables forecasting), Facilities (HVAC filters, lighting), and Quality (calibration/consumable reagents). The only use-case-specific elements are the criticality taxonomy and the optional failure-prediction exogenous feature; both are cleanly swappable inputs.
