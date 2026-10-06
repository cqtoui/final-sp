import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldAlert, FlaskConical, Eye, Clock, Users, AlertTriangle } from "lucide-react";

const capitalize = (s) =>
  s === "—" ? "—" : s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export default function SafetyRiskSummary({ incidents = [] }) {
  const a = useMemo(() => {
    const open = incidents.filter((i) => i.status === "open" || !i.status);
    const openCount = open.length;

    const deptCounts = {};
    incidents.forEach((i) => {
      if (i.department) {
        const d = i.department.replace(/_/g, " ");
        deptCounts[d] = (deptCounts[d] || 0) + 1;
      }
    });
    const deptEntries = Object.entries(deptCounts).sort((x, y) => y[1] - x[1]);
    const highestDept = deptEntries[0]?.[0] || "—";

    const gearCounts = {};
    incidents.forEach((i) => {
      (i.missing_gear || []).forEach((g) => {
        const gear = g.replace(/_/g, " ");
        gearCounts[gear] = (gearCounts[gear] || 0) + 1;
      });
    });
    const gearEntries = Object.entries(gearCounts).sort((x, y) => y[1] - x[1]);
    const topGear = gearEntries[0]?.[0] || "—";

    const timeSlots = {};
    incidents.forEach((i) => {
      const date = new Date(i.incident_time || i.created_date);
      if (isNaN(date)) return;
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(date);
      let hour = parseInt(parts.find((p) => p.type === "hour").value);
      if (hour === 24) hour = 0;
      const minute = parseInt(parts.find((p) => p.type === "minute").value);
      const slot = hour * 2 + (minute >= 30 ? 1 : 0);
      timeSlots[slot] = (timeSlots[slot] || 0) + 1;
    });
    let peakSlot = -1, peakCount = 0;
    Object.entries(timeSlots).forEach(([slot, count]) => {
      if (count > peakCount) { peakCount = count; peakSlot = parseInt(slot); }
    });
    let peakTime = "—";
    if (peakSlot >= 0) {
      const startHour = Math.floor(peakSlot / 2);
      const startMin = peakSlot % 2 === 0 ? 0 : 30;
      const endTotalMin = startHour * 60 + startMin + 30;
      const endHour = Math.floor(endTotalMin / 60) % 24;
      const endMin = endTotalMin % 60;
      const fmt = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      peakTime = `${fmt(startHour, startMin)}–${fmt(endHour, endMin)}`;
    }

    const workerCounts = {};
    incidents.forEach((i) => {
      if (i.worker_name) {
        workerCounts[i.worker_name] = (workerCounts[i.worker_name] || 0) + 1;
      }
    });
    const workerEntries = Object.entries(workerCounts).sort((x, y) => y[1] - x[1]);
    const atRiskWorkers = workerEntries.slice(0, 3).map(([name]) => name);

    let riskLevel, riskBg, dotColor;
    if (openCount === 0) {
      riskLevel = "Low"; riskBg = "bg-emerald-50 text-emerald-700 border-emerald-200"; dotColor = "bg-emerald-500";
    } else if (openCount <= 5) {
      riskLevel = "Medium"; riskBg = "bg-amber-50 text-amber-700 border-amber-200"; dotColor = "bg-amber-500";
    } else if (openCount <= 12) {
      riskLevel = "High"; riskBg = "bg-orange-50 text-orange-700 border-orange-200"; dotColor = "bg-orange-500";
    } else {
      riskLevel = "Critical"; riskBg = "bg-red-50 text-red-700 border-red-200"; dotColor = "bg-red-500";
    }

    const totalIncidents = incidents.length;
    const criticalCount = incidents.filter((i) => i.severity === "critical").length;

    return { highestDept, topGear, peakTime, atRiskWorkers, riskLevel, riskBg, dotColor, openCount, totalIncidents, criticalCount };
  }, [incidents]);

  const rows = [
    { icon: FlaskConical, label: "Highest-Risk Department", value: capitalize(a.highestDept) },
    { icon: Eye, label: "Most Missed Gear", value: capitalize(a.topGear) },
    { icon: Clock, label: "Peak Violation Time", value: a.peakTime },
    { icon: AlertTriangle, label: "Total Incidents Logged", value: a.totalIncidents },
    { icon: ShieldAlert, label: "Critical Cases", value: a.criticalCount },
  ];

  return (
    <Card className="border shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" /> Safety Risk Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-3">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border w-fit ${a.riskBg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${a.dotColor}`} />
          {a.riskLevel} Risk · {a.openCount} open
        </div>

        <div className="flex-1 flex flex-col justify-center">
          {rows.map((r, idx) => (
            <div key={r.label} className={`flex items-center gap-3 py-2 ${idx < rows.length - 1 ? "border-b border-border/50" : ""}`}>
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <r.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground flex-1">{r.label}</span>
              <span className="text-sm font-semibold text-right">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs text-muted-foreground">Workers Needing Attention</span>
          </div>
          {a.atRiskWorkers.length > 0 ? (
            <p className="text-sm font-medium pl-6">{a.atRiskWorkers.join(", ")}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic pl-6">None</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}