import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

const KPI_COLORS = {
  blue: { bg: "bg-blue-50", fg: "text-blue-600" },
  red: { bg: "bg-red-50", fg: "text-red-600" },
  green: { bg: "bg-green-50", fg: "text-green-600" },
  amber: { bg: "bg-amber-50", fg: "text-amber-600" },
  orange: { bg: "bg-orange-50", fg: "text-orange-600" },
  violet: { bg: "bg-violet-50", fg: "text-violet-600" },
  slate: { bg: "bg-slate-100", fg: "text-slate-600" },
} satisfies Record<string, { bg: string; fg: string }>;

export function KpiCard({
  icon: Icon,
  label,
  value,
  color = "blue",
  hint,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: ReactNode;
  color?: keyof typeof KPI_COLORS;
  hint?: string;
}) {
  const c = KPI_COLORS[color];
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.fg}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-900">{value}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
    </Card>
  );
}

type BadgeColor = "red" | "orange" | "amber" | "blue" | "green" | "violet" | "slate";

const BADGE_COLORS: Record<BadgeColor, string> = {
  red: "bg-red-50 text-red-700 ring-red-600/10",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/10",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/10",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/10",
  green: "bg-green-50 text-green-700 ring-green-600/10",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/10",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

export function Badge({ color, children }: { color: BadgeColor; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_COLORS[color]}`}
    >
      {children}
    </span>
  );
}

export function Dot({ color }: { color: BadgeColor }) {
  const dotColor: Record<BadgeColor, string> = {
    red: "bg-red-500",
    orange: "bg-orange-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
    violet: "bg-violet-500",
    slate: "bg-slate-400",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${dotColor[color]}`} />;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  color = "blue",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: "blue" | "red" | "slate";
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-700",
    red: "bg-red-600 hover:bg-red-700",
    slate: "bg-slate-700 hover:bg-slate-800",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${colors[color]}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
