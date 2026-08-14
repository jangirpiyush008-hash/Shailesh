"use client";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";

const COLORS = ["#7C3AED", "#F43F5E", "#F59E0B", "#10B981", "#0EA5E9", "#8B5CF6", "#94A3B8"];

/* --------- number formatters (kills JS float noise like 42632.490000000005) --------- */
function aed(n: number | string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return "AED " + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function shortAed(n: number | string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)      return `AED ${(v / 1_000).toFixed(1)}k`;
  return "AED " + v.toFixed(0);
}

const TOOLTIP_STYLE = { borderRadius: 8, border: "1px solid #e5e7eb", padding: "6px 10px", fontSize: 12 };

export function RevenueTrend({ data }: { data: { month: string; revenue: number; expenses: number }[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Revenue vs Expenses</CardTitle>
      </CardHeader>
      <CardBody className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={shortAed} width={70} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: string) => [aed(value), name === "revenue" ? "Revenue" : "Expenses"]}
              labelStyle={{ fontWeight: 600, color: "#111827" }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} fill="url(#rev)" />
            <Area type="monotone" dataKey="expenses" stroke="#F43F5E" strokeWidth={2} fill="url(#exp)" />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}

export function ExpenseCategoryChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Expense Categories</CardTitle></CardHeader>
      <CardBody className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: any, name: any) => [aed(value), name]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}

export function StatusBar({ data }: { data: { status: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Projects by Status</CardTitle></CardHeader>
      <CardBody className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="status" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, "Projects"]} />
            <Bar dataKey="count" fill="#7C3AED" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
