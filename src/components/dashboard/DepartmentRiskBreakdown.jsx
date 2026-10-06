import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BarChart3, Wrench, CameraOff } from "lucide-react";

const DEPT_LABELS = {
  assembly: "Assembly",
  electrical: "Electrical",
  warehouse: "Warehouse",
  chemical_lab: "Chemical Lab",
  maintenance: "Maintenance",
};

export default function DepartmentRiskBreakdown({ incidents = [], entryPoints = [] }) {
  const [selected, setSelected] = useState(null);

  const depts = useMemo(() => {
    const counts = {};
    incidents.forEach((i) => {
      if (i.department) {
        counts[i.department] = (counts[i.department] || 0) + 1;
      }
    });

    const statusMap = {};
    entryPoints.forEach((ep) => {
      if (!ep.department) return;
      if (!statusMap[ep.department]) statusMap[ep.department] = [];
      statusMap[ep.department].push(ep.camera_status || "online");
    });

    return Object.keys(DEPT_LABELS).map((key) => {
      const statuses = statusMap[key] || [];
      let status = "online";
      if (statuses.length > 0 && statuses.every((s) => s === "maintenance")) status = "maintenance";
      else if (statuses.length > 0 && statuses.every((s) => s === "offline")) status = "offline";
      return {
        key,
        label: DEPT_LABELS[key],
        count: counts[key] || 0,
        status,
        hasCameras: statuses.length > 0,
      };
    }).sort((a, b) => b.count - a.count);
  }, [incidents, entryPoints]);

  const maxCount = Math.max(...depts.map((d) => d.count), 1);

  return (
    <Card className="border shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Department Risk Breakdown
        </CardTitle>
        <CardDescription className="text-xs">Incidents by department</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center gap-0.5">
        {depts.map((d) => {
          const pct = (d.count / maxCount) * 100;
          const isSelected = selected === d.key;
          const isMaintenance = d.status === "maintenance";
          const isOffline = d.status === "offline";
          const isDisabled = isMaintenance || isOffline;

          return (
            <div
              key={d.key}
              onClick={() => setSelected(isSelected ? null : d.key)}
              className={`p-1.5 -mx-1 rounded-lg cursor-pointer transition-colors group ${
                isSelected ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">{d.label}</span>
                  {isMaintenance && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                      <Wrench className="w-2.5 h-2.5" /> Maintenance
                    </span>
                  )}
                  {isOffline && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
                      <CameraOff className="w-2.5 h-2.5" /> Offline
                    </span>
                  )}
                </div>
                <span className={`font-semibold shrink-0 ml-2 ${d.count > 0 ? "text-primary" : "text-muted-foreground/60"}`}>
                  {d.count > 0 ? d.count : "No incidents"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isDisabled
                      ? "bg-muted-foreground/30"
                      : isSelected
                      ? "bg-primary"
                      : "bg-primary/70 group-hover:bg-primary"
                  }`}
                  style={{ width: `${isDisabled ? 100 : pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}