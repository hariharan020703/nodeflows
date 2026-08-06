---
name: voice-to-report
description: Converts a technician's spoken voice recording — captured while working, immediately after a repair, or during a shift handover — into a clean, structured repair note ready for downstream use by the Report Writer and Work Order Generator skills. Use when a technician submits an audio file (WAV, M4A, or MP3) via Teams upload, mobile app, or dictation-to-inbox and it needs to become structured text instead of a lost artifact on a personal phone.
---

# Voice-to-Report

## Instructions

1. Receive the audio file via the submission channel (Teams upload, mobile app, or dictation-to-inbox).
2. Run automatic speech recognition (ASR) to produce a raw, punctuated transcript.
3. Apply a maintenance-vocabulary correction pass: cross-reference recognized terms against the plant's vocabulary list to correct commonly mis-transcribed equipment nicknames, part numbers, and trade jargon (e.g., "megger," "die cushion," "sheave").
4. Identify and explicitly mark any segment the ASR model flags as low-confidence or unintelligible as `[inaudible]` — never substitute a plausible guess for genuinely unclear audio.
5. If `equipment_id` was not already known, attempt to extract a candidate equipment reference from the transcript, using fuzzy matching against SAP PM equipment master data (via the SAP PM connector).
6. Attempt to extract a candidate `work_order_ref` if the technician mentions an existing order number or clearly references ongoing work; otherwise leave null for a new-issue flow.
7. Assemble the structured output record and pass it to the Fusion Layer for combination with any OCR or photo-derived evidence submitted alongside it.

For the full reusability rationale across other manufacturing departments, see REFERENCE.md.

## Inputs

- Voice recording (audio file: WAV, M4A, or MP3), typically 15 seconds to 5 minutes in length.
- Optional context if already known: `work_order_ref`, `equipment_id`.
- `technician_id` (from the submission channel's authenticated user).
- `captured_at` (submission timestamp).
- Maintenance-domain vocabulary list (equipment nicknames, part numbers, trade jargon) maintained per plant, used for ASR correction.

## Output Format

Produce a structured note record:
```json
{
  "work_order_ref": "WO-2026-100205 or null",
  "equipment_id": "10004555 or null",
  "candidate_equipment_reference": "Motor07 line5 (if equipment_id unresolved)",
  "technician_id": "TECH-1004",
  "note_text": "Motor07 on line5 making a grinding noise on startup... [inaudible]... recommend bearing replacement.",
  "captured_at": "2026-07-29T05:15:00",
  "transcription_confidence": "high | medium | low"
}
```

## Examples

**Input:** A 47-second voice memo recorded by TECH-1004 at 2026-07-29 05:15, referencing Motor07 on Line 5.

**Raw ASR output (before correction):** "motor seven on line five making a grinding noise on start up got worse over the shift are temp on the bearing end is seventy eight c higher than normal vibration reading elevated on the drive end recommend bearing replacement don't think this is safe to run through the weekend without it"

**Output (after Voice-to-Report processing):**
```json
{
  "work_order_ref": null,
  "equipment_id": "10004555",
  "candidate_equipment_reference": "Motor07 line5",
  "technician_id": "TECH-1004",
  "note_text": "Motor07 on line5 making a grinding noise on startup, got worse over the shift. IR temp on the bearing end is 78C, higher than normal. Vibration reading elevated on the drive end. Recommend bearing replacement, don't think this is safe to run through the weekend without it.",
  "captured_at": "2026-07-29T05:15:00",
  "transcription_confidence": "high"
}
```
This matches the corresponding row in `Sample Data/technician_notes.csv` for `WO-2026-100205`.

## Guardrails

- Never substitute inferred content for a segment marked `[inaudible]`; downstream skills must treat `[inaudible]` sections as explicitly missing evidence.
- Always preserve the raw ASR transcript alongside the corrected version for audit purposes, even though only the corrected version is used for drafting.
- `transcription_confidence: low` must be surfaced to the human reviewer in any downstream draft; it must never be silently treated as equivalent to a high-confidence transcript.
- Equipment reference extraction is advisory only — it must be confirmed against SAP PM master data before being treated as authoritative `equipment_id`.
