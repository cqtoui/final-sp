import { cn } from "@/lib/utils";

const FLOW_TONES = {
  default: "214 18% 62%",
  primary: "21 90% 48%",
  success: "175 84% 32%",
  danger: "0 72% 51%",
  warning: "36 100% 46%",
};

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, variant = "default", flash = false, delay = 0 }) {
  const variants = {
    default: "bg-card",
    primary: "bg-primary/5 border-primary/20",
    success: "bg-teal-50 border-teal-200",
    danger: "bg-red-50 border-red-200",
    warning: "bg-amber-50 border-amber-200",
  };

  const iconVariants = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-teal-100 text-teal-700",
    danger: "bg-red-100 text-red-600",
    warning: "bg-amber-100 text-amber-600",
  };

  return (
    <div
      className={cn(
        "sg-border-flow rounded-xl border p-5 transition-shadow hover:shadow-md motion-safe:transition-all",
        variants[variant],
        flash && "ring-2 ring-primary shadow-lg motion-safe:scale-[1.02]",
      )}
      style={{
        "--sg-flow": FLOW_TONES[variant] || FLOW_TONES.default,
        "--sg-delay": `${delay}s`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn("text-xs font-medium", trendUp ? "text-emerald-700" : "text-red-600")}>
              {trendUp ? "Up: " : "Down: "}{trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2.5 rounded-xl", iconVariants[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}