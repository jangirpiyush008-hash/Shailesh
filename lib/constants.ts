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

// Common labour types (right-side expenses) — used as quick-pick suggestions
// so admin doesn't have to re-type Carpenter/Painter/etc every time.
export const LABOUR_PRESETS = [
  "Carpenter",
  "Painter",
  "Electrician",
  "Helper",
  "Driver",
  "Loader",
  "Fabricator",
  "Welder",
  "Foreman",
  "Supervisor",
] as const;
