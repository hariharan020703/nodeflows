// Icon path fragments. The Sales-prefixed keys are copied verbatim (path data) from the
// SingleFile source (html2.html / html3.html) so the Sales fan renders with the exact glyphs
// the live app uses. The generic keys are a reusable stroke-icon set for the placeholder
// departments (their original glyphs were not present in the three captured pages).
export const ICONS = {
  // --- exact, from source (department hub icons, html1.html) ---
  hubTree:
    '<path d="M12 21V5.5"/><path d="M12 10 7 7"/><path d="M12 10l5-3"/><path d="M12 15 8 13"/><path d="M12 15l4-2"/>',
  deptSales: '<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
  deptDeals: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  deptMarketing: '<path d="M8 5l12 7-12 7V5z"/>',
  deptOperations: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  deptIntelligence: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',
  deptCustomer: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  deptBackOffice:
    '<path d="M12 3v18"/><path d="M17 7c-1-1.5-2.5-2-5-2-3 0-4.5 1.5-4.5 3.5S9 12 12 12s4.5 1.5 4.5 3.5S15 19 12 19c-2.5 0-4-.5-5-2"/>',

  // --- exact, from source (the 22 Sales job nodes, html2.html) ---
  icpDefinition: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5"/>',
  marketMapping: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18-3-3-3-15 0-18z"/>',
  triggerDetection: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/>',
  databaseMining:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  webScraping: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5z"/>',
  socialMining:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16.5 14.6c3 .3 5 2.1 5 5"/>',
  listBuilding:
    '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/>',
  contactEnrichment: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  emailVerification: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9"/>',
  accountEnrichment:
    '<path d="M5 21V5a1 1 0 0 1 1-1h7v17"/><path d="M13 9h6v12"/><path d="M3 21h18"/><path d="M8 8h2M8 12h2M16 13h1M16 17h1"/>',
  fitScoring: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M2 20h20"/>',
  personalizationResearch: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',
  coldEmailDrafting: '<path d="M12 19l7-7-3-3-7 7-1 4 4-1z"/><path d="M15 6l3 3"/>',
  linkedinMessaging: '<path d="M4 5h16v11h-9l-5 4v-4H4V5z"/>',
  proofMatching: '<path d="M6 2h8l6 6v14H6V2z"/><path d="M14 2v6h6"/><path d="M9 14l2 2 4-4"/>',
  campaignOrchestration:
    '<circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M7.2 6H15a4 4 0 0 1 4 4v5.5"/>',
  campaignLaunch:
    '<path d="M12 2c3 2 5 6 5 10l-5 5-5-5c0-4 2-8 5-10z"/><circle cx="12" cy="9" r="2"/><path d="M7 14l-3 5 5-1"/><path d="M17 14l3 5-5-1"/>',
  deliverability: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  sendOptimization: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',

  // --- generic stroke set reused for the placeholder (non-Sales) departments ---
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-6 2 2-6 6-2z"/>',
  check: '<path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  mail: '<path d="M4 5h16v14H4z"/><path d="M4 5l8 7 8-7"/>',
  mega: '<path d="M3 11v2a2 2 0 0 0 2 2h1l3 5V6l-3 5H5a2 2 0 0 0-2 2z"/><path d="M15 5a7 7 0 0 1 0 14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16.5 14.6c3 .3 5 2.1 5 5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M4.2 7.8l2.6 1.5M17.2 14.7l2.6 1.5M4.2 16.2l2.6-1.5M17.2 9.3l2.6-1.5M3 12h3M18 12h3"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M2 20h20"/>',
  book: '<path d="M5 21V5a1 1 0 0 1 1-1h7v17"/><path d="M13 9h6v12"/><path d="M3 21h18"/>',
  phone: '<path d="M6 2h8l6 6v14H6V2z"/><path d="M9 14l2 2 4-4"/>',
  video: '<path d="M4 5h16v11h-9l-5 4v-4H4V5z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  rocket: '<path d="M12 2c3 2 5 6 5 10l-5 5-5-5c0-4 2-8 5-10z"/><circle cx="12" cy="9" r="2"/><path d="M7 14l-3 5 5-1"/><path d="M17 14l3 5-5-1"/>',
  heart: '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 5a5.5 5.5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  doc: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/>',
  scale: '<path d="M12 3v18"/><path d="M4 8l4-3 4 3M12 8l4-3 4 3"/><path d="M4 8l0 5a4 2 0 008 0V8M12 8l0 5a4 2 0 008 0V8"/>',
}

export function svgIcon(key, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[key] || ICONS.spark}</svg>`
}
