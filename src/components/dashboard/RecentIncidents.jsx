import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const severityColors = {
  low: "bg-blue-100 text-blue-700 border-blue-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const statusColors = {
  open: "bg-red-100 text-red-700",
  acknowledged: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  escalated: "bg-purple-100 text-purple-700",
};

export default function RecentIncidents({ incidents }) {
  const recent = incidents.slice(0, 5);

  return (
    <Card className="border shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Recent Incidents</CardTitle>
        <Link to="/incidents" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        {recent.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
            No incidents recorded yet
          </div>
        ) : (
          <div className="flex-1 flex flex-col divide-y divide-border">
            {recent.map((inc) => (
              <div key={inc.id} className="flex-1 flex items-center gap-3 px-6 hover:bg-primary/5 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inc.worker_name || "Unknown Worker"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Missing: {(inc.missing_gear || []).join(", ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className={severityColors[inc.severity || "medium"]}>
                    {inc.severity || "medium"}
                  </Badge>
                  <Badge className={statusColors[inc.status || "open"]}>
                    {inc.status || "open"}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 w-16 text-right">
                  {format(new Date(inc.created_date), "MMM d, HH:mm")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}