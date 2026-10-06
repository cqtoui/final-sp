import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, Hash, Clock, Gauge } from "lucide-react";

function formatScanTime(value) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) + " UAE";
}

function complianceTone(rate) {
  if (rate == null || Number.isNaN(Number(rate))) {
    return "text-muted-foreground";
  }
  const value = Number(rate);
  if (value >= 90) {
    return "text-emerald-700";
  }
  if (value >= 70) {
    return "text-amber-700";
  }
  return "text-red-600";
}

export default function WorkerScanPanel({ scanResult }) {
  const name = scanResult?.worker_identified || "Unknown Worker";
  const employeeId = String(scanResult?.employee_id || "").trim() || "—";
  const scannedAt = formatScanTime(scanResult?.scanned_at);
  const rate = scanResult?.compliance_rate;
  const rateLabel =
    rate == null || rate === "" || Number.isNaN(Number(rate))
      ? "—"
      : `${Number(rate)}%`;

  const rows = [
    { icon: User, label: "Name", value: name },
    { icon: Hash, label: "ID", value: employeeId },
    { icon: Clock, label: "Scan time", value: scannedAt },
    { icon: Gauge, label: "Compliance rate", value: rateLabel, tone: complianceTone(rate) },
  ];

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border shadow-sm">
      <CardHeader className="shrink-0 pb-2 pt-4">
        <CardTitle className="text-base font-semibold">Worker Identified</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col justify-evenly gap-2 pb-4">
        {scanResult?.face_recognition_status && (
          <p className="text-xs text-muted-foreground">
            {scanResult.face_recognition_status}
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {row.label}
                </div>
                <p className={`truncate text-sm font-semibold ${row.tone || "text-foreground"}`}>
                  {row.value}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
