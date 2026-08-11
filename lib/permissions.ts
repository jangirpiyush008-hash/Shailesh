import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "coordinator" | "employee";
export type AccessLevel = "full" | "edit" | "read" | "view";

export type CurrentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  access_level: AccessLevel;
};

export async function currentProfile(): Promise<CurrentProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, access_level")
    .eq("id", user.id)
    .single();
  return (data as CurrentProfile) ?? null;
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

export function permissions(profile: { role?: Role | null; access_level?: AccessLevel | null } | null | undefined): Perms {
  const role  = (profile?.role ?? null) as Role | null;
  const level = (profile?.access_level ?? "full") as AccessLevel;

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

  return base;   // no auth → nothing
}

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, { label: string; desc: string }> = {
  full: { label: "Full",       desc: "Line prices · add · edit · delete · create projects" },
  edit: { label: "Edit",       desc: "Line prices · add · edit · create (no delete)" },
  read: { label: "Read-only",  desc: "See line prices — cannot add or edit anything" },
  view: { label: "View-only",  desc: "No prices visible — can log expenses without rate" },
};
