import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "coordinator" | "employee";

export type CurrentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export async function currentProfile(): Promise<CurrentProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();
  return (data as CurrentProfile) ?? null;
}

/**
 * Granular permission model:
 *
 * ADMIN
 *   • Full access to everything (revenue, profit, totals, exports, reports)
 *
 * COORDINATOR
 *   • Can see individual expense line prices (unit rate, per-row amount)
 *   • CANNOT see: project value (revenue), net profit, total cost aggregate,
 *     budget %, Reports tab, Overview cost-summary, Excel export, WhatsApp/PPT reports
 *
 * EMPLOYEE
 *   • Can see: material + labour + food listings WITHOUT any price
 *   • CANNOT see: unit rate, per-row amount, table totals, any KPI $ figure,
 *     Overview / Reports tabs, exports, reports
 *   • Can still add expenses (form hides the rate field — they just log
 *     description + qty + unit; admin/coord fills price later)
 */
export function permissions(role: Role | null | undefined) {
  const isAdmin       = role === "admin";
  const isCoordinator = role === "coordinator";
  const isEmployee    = role === "employee";
  return {
    role,
    isAdmin,
    isCoordinator,
    isEmployee,

    // Aggregate financials (revenue, profit, total cost, budget %)
    canSeeRevenue:      isAdmin,
    canSeeProfit:       isAdmin,
    canSeeTotals:       isAdmin,

    // Per-row expense prices (unit rate + amount columns)
    canSeeLinePrices:   isAdmin || isCoordinator,

    // Tabs that show aggregated $ figures
    canSeeOverviewTab:  isAdmin,      // Overview shows category cost summary
    canSeeReportsTab:   isAdmin,      // Reports shows category breakdown

    // Exports + external sharing (contain full financials)
    canExportExcel:     isAdmin,
    canGenerateReport:  isAdmin,      // WhatsApp report + PPT + PDF

    // Project management
    canCreateProject:   isAdmin || isCoordinator,   // employees only add expenses to existing
    canEditProject:     isAdmin || isCoordinator,
    canDeleteProject:   isAdmin,

    // Expense management
    canAddExpense:      true,                        // all roles can add
    canEnterPrice:      isAdmin || isCoordinator,    // employee's add-form hides price fields
    canDeleteExpense:   isAdmin || isCoordinator,

    // User management
    canManageUsers:     isAdmin,
  };
}

export type Perms = ReturnType<typeof permissions>;
