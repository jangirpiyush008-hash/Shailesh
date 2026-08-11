// Standard units used across SBJ Job Cards. Order matters — most common first.
export const UNITS = [
  "Sheet", "NOS", "SQM", "SQY", "RM", "Hours",
  "Pkt", "Trip", "Drum", "Litre", "Gallon", "ITEM",
] as const;

// Predefined coordinator names — free-text field on projects, so no user
// account is required. Admin can also type a custom name.
export const COORDINATOR_PRESETS = [
  "Manoj Kumar Jangir 1",
  "Manoj Kumar Jangir 2",
  "Motilal Jangir",
  "Suresh Jangir",
  "Naresh Jangir",
  "Prakash Jangir",
] as const;
