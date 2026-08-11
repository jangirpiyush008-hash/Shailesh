import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "coordinator" | "employee";
export type AccessLevel = "full" | "edit" | "read" | "view";

export type CurrentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  access_level: AccessLevel;
  permissions_overrides?: Partial<Record<PermKey, boolean>>;
};

export type PermKey =
  | "canSeeRevenue" | "canSeeProfit" | "canSeeTotals" | "canSeeLinePrices"
  | "canSeeOverviewTab" | "canSeeReportsTab"
  | "canExportExcel" | "canGenerateReport"
  | "canCreateProject" | "canEditProject" | "canDeleteProject"
  | "canAddExpense" | "canEnterPrice" | "canDeleteExpense"
  | "canManageUsers";

export async function currentProfile(): Promise<CurrentProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try the full select including overrides (post-migration 0006)
  const full = await supabase
    .from("profiles")
    .select("id, email, full_name, role, access_level, permissions_overrides")
    .eq("id", user.id)
    .maybeSingle();
  if (!full.error && full.data) return full.data as CurrentProfile;

  // Fallback A: overrides column missing (pre-0006) — try without it
  const mid = await supabase
    .from("profiles")
    .select("id, email, full_name, role, access_level")
    .eq("id", user.id)
    .maybeSingle();
  if (!mid.error && mid.data) return { ...(mid.data as any), permissions_overrides: {} } as CurrentProfile;

  // Fallback B: access_level column also missing (pre-0005) — legacy select
  const legacy = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!legacy.error && legacy.data) {
    const p = legacy.data as any;
    return { ...p, access_level: p.role === "employee" ? "view" : "full", permissions_overrides: {} };
  }
  return null;
}

/**
 * Permission matrix — combines role AND access_level:
 *
 *  ADMIN                          → full access always (access_level ignored)
 *  EMPLOYEE                       → view-only, can add expenses without price
 *  COORDINATOR + full             → default coordinator (line prices + add/edit/delete + create)
 *  COORDINATOR + edit             → same as full but can't delete expenses
 *  COORDINATOR + read             → can see prices but no add/edit/delete/create
 *  COORDINATOR + view             → same as employee (no prices, no delete, no create)
 *
 * None of the roles ever see aggregate financials (revenue, profit, total cost)
 * except admin.
 */
export type Perms = {
  role: Role | null;
  access_level: AccessLevel | null;
  isAdmin: boolean;
  isCoordinator: boolean;
  isEmployee: boolean;

  canSeeRevenue: boolean;
  canSeeProfit: boolean;
  canSeeTotals: boolean;
  canSeeLinePrices: boolean;
  canSeeOverviewTab: boolean;
  canSeeReportsTab: boolean;

  canExportExcel: boolean;
  canGenerateReport: boolean;

  canCreateProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;

  canAddExpense: boolean;
  canEnterPrice: boolean;
  canDeleteExpense: boolean;

  canManageUsers: boolean;
};

export function permissions(profile: { role?: Role | null; access_level?: AccessLevel | null; permissions_overrides?: Partial<Record<PermKey, boolean>> } | null | undefined): Perms {
  const role  = (profile?.role ?? null) as Role | null;
  const level = (profile?.access_level ?? "full") as AccessLevel;
  const overrides = (profile?.permissions_overrides ?? {}) as Partial<Record<PermKey, boolean>>;

  const isAdmin       = role === "admin";
  const isCoordinator = role === "coordinator";
  const isEmployee    = role === "employee";

  const base: Perms = {
    role, access_level: level,
    isAdmin, isCoordinator, isEmployee,
    canSeeRevenue: false, canSeeProfit: false, canSeeTotals: false,
    canSeeLinePrices: false, canSeeOverviewTab: false, canSeeReportsTab: false,
    canExportExcel: false, canGenerateReport: false,
    canCreateProject: false, canEditProject: false, canDeleteProject: false,
    canAddExpense: false, canEnterPrice: false, canDeleteExpense: false,
    canManageUsers: false,
  };

  // ---- ADMIN: everything ----
  if (isAdmin) {
    return { ...base,
      canSeeRevenue: true, canSeeProfit: true, canSeeTotals: true,
      canSeeLinePrices: true, canSeeOverviewTab: true, canSeeReportsTab: true,
      canExportExcel: true, canGenerateReport: true,
      canCreateProject: true, canEditProject: true, canDeleteProject: true,
      canAddExpense: true, canEnterPrice: true, canDeleteExpense: true,
      canManageUsers: true,
    };
  }

  // ---- EMPLOYEE: log-only, no prices, no delete ----
  if (isEmployee) {
    return { ...base,
      canAddExpense: true,      // can add expenses (logs description + qty)
      canEnterPrice: false,     // add form hides Unit rate + Total pill
    };
  }

  // ---- COORDINATOR: depends on access_level ----
  if (isCoordinator) {
    switch (level) {
      case "full":
        return { ...base,
          canSeeLinePrices: true,
          canCreateProject: true, canEditProject: true,
          canAddExpense: true, canEnterPrice: true, canDeleteExpense: true,
        };
      case "edit":
        return { ...base,
          canSeeLinePrices: true,
          canCreateProject: true, canEditProject: true,
          canAddExpense: true, canEnterPrice: true, canDeleteExpense: false,
        };
      case "read":
        return { ...base,
          canSeeLinePrices: true,   // can see prices but purely read-only
        };
      case "view":
        return { ...base,
          canAddExpense: true, canEnterPrice: false,  // like employee
        };
    }
  }

  return applyOverrides(base, overrides);
}

/** Apply any per-user overrides on top of the computed base permissions. */
function applyOverrides(base: Perms, overrides: Partial<Record<PermKey, boolean>>): Perms {
  const out: any = { ...base };
  for (const k of Object.keys(overrides) as PermKey[]) {
    if (typeof overrides[k] === "boolean") out[k] = overrides[k];
  }
  return out as Perms;
}

/** Human-friendly labels for the permission-toggle UI, grouped by section. */
export const PERM_GROUPS: {
  section: string;
  keys: { key: PermKey; label: string; hint?: string }[];
}[] = [
  {
    section: "Financial visibility",
    keys: [
      { key: "canSeeRevenue",     label: "See project revenue (value)" },
      { key: "canSeeProfit",      label: "See net profit" },
      { key: "canSeeTotals",      label: "See total cost (aggregates)" },
      { key: "canSeeLinePrices",  label: "See per-row prices (unit rate + total)" },
      { key: "canSeeOverviewTab", label: "See Overview tab (cost summary)" },
      { key: "canSeeReportsTab",  label: "See Reports tab (category breakdown)" },
    ],
  },
  {
    section: "Expense management",
    keys: [
      { key: "canAddExpense",     label: "Add new expenses" },
      { key: "canEnterPrice",     label: "Enter prices when adding" },
      { key: "canDeleteExpense",  label: "Delete expenses" },
    ],
  },
  {
    section: "Project management",
    keys: [
      { key: "canCreateProject",  label: "Create new projects" },
      { key: "canEditProject",    label: "Edit project details" },
      { key: "canDeleteProject",  label: "Delete projects" },
    ],
  },
  {
    section: "Exports & sharing",
    keys: [
      { key: "canExportExcel",    label: "Export Excel Job Card" },
      { key: "canGenerateReport", label: "Generate WhatsApp / PPT reports" },
    ],
  },
  {
    section: "Administration",
    keys: [
      { key: "canManageUsers",    label: "Manage users & access" },
    ],
  },
];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, { label: string; desc: string }> = {
  full: { label: "Full",       desc: "Line prices · add · edit · delete · create projects" },
  edit: { label: "Edit",       desc: "Line prices · add · edit · create (no delete)" },
  read: { label: "Read-only",  desc: "See line prices — cannot add or edit anything" },
  view: { label: "View-only",  desc: "No prices visible — can log expenses without rate" },
};
