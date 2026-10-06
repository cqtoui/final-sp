import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { appClient } from "@/api/appClient";
import { AlertTriangle, Users, Camera, CheckCircle } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import StatCard from "../components/dashboard/StatCard";
import ComplianceChart from "../components/dashboard/ComplianceChart";
import GearBreakdownChart from "../components/dashboard/GearBreakdownChart";
import RecentIncidents from "../components/dashboard/RecentIncidents";
import SafetyRiskSummary from "../components/dashboard/SafetyRiskSummary";
import DepartmentRiskBreakdown from "../components/dashboard/DepartmentRiskBreakdown";

export default function Dashboard() {
  const [uaeTime, setUaeTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const t = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const d = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", year: "numeric" });
      setUaeTime(`${d} · ${t} UAE`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => appClient.entities.Incident.list("-created_date"),
    refetchInterval: 6000,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: () => appClient.entities.Worker.list(),
    refetchInterval: 15000,
  });

  const { data: entryPoints = [] } = useQuery({
    queryKey: ["entryPoints"],
    queryFn: () => appClient.entities.EntryPoint.list(),
    refetchInterval: 5000,
  });

  // Flash animation when scans count changes
  const prevScans = useRef(0);
  const [scansFlash, setScansFlash] = useState(false);
  const prevIncidents = useRef(0);
  const [incidentsFlash, setIncidentsFlash] = useState(false);

  // Live metrics — UAE timezone (UTC+4)
  const nowUAE = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
  const todayUAE = new Date(nowUAE); todayUAE.setHours(0, 0, 0, 0);
  const openIncidents = incidents.filter(i => i.status === "open").length;
  const activeWorkers = workers.filter(w => w.status === "active" || !w.status).length;
  const totalScansToday = entryPoints.reduce((sum, ep) => sum + (ep.scans_today || 0), 0);
  const incidentsToday = incidents.filter(i => new Date(i.created_date) >= todayUAE).length;
  const scoredWorkers = workers.filter((worker) => worker.status === "active" || !worker.status);
  const totalScans = workers.reduce((sum, worker) => sum + Number(worker.total_scans || 0), 0);
  const complianceRate = scoredWorkers.length > 0
    ? Math.round(
        scoredWorkers.reduce(
          (sum, worker) => sum + Number(worker.compliance_rate ?? 100),
          0
        ) / scoredWorkers.length
      )
    : totalScans > 0
      ? Math.max(0, Math.min(100, Math.round(((totalScans - incidents.length) / totalScans) * 100)))
      : incidents.length === 0 ? 100 : 0;

  // Flash effect when new scans or incidents detected
  useEffect(() => {
    if (prevScans.current !== 0 && totalScansToday > prevScans.current) {
      setScansFlash(true);
      setTimeout(() => setScansFlash(false), 1000);
    }
    prevScans.current = totalScansToday;
  }, [totalScansToday]);

  useEffect(() => {
    if (prevIncidents.current !== 0 && openIncidents > prevIncidents.current) {
      setIncidentsFlash(true);
      setTimeout(() => setIncidentsFlash(false), 1200);
    }
    prevIncidents.current = openIncidents;
  }, [openIncidents]);

  return (
    <div className="mx-auto max-w-[1600px] p-5 lg:p-7">
      <PageHeader title="Dashboard" subtitle={uaeTime || "Real-time PPE compliance overview"} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Compliance Rate"
          value={`${complianceRate}%`}
          subtitle={complianceRate >= 90 ? "Excellent compliance" : complianceRate >= 70 ? "Needs improvement" : "Critical — take action"}
          icon={CheckCircle}
          variant={complianceRate >= 90 ? "success" : complianceRate >= 70 ? "warning" : "danger"}
          trend={totalScansToday > 0 ? `${incidentsToday} violation${incidentsToday !== 1 ? "s" : ""} today` : undefined}
          trendUp={incidentsToday === 0}
          delay={0}
        />
        <StatCard
          title="Open Incidents"
          value={openIncidents}
          subtitle={openIncidents === 0 ? "All clear" : "Needs attention"}
          icon={AlertTriangle}
          variant={openIncidents === 0 ? "success" : openIncidents > 5 ? "danger" : "warning"}
          flash={incidentsFlash}
          delay={0.8}
        />
        <StatCard
          title="Workers Active"
          value={activeWorkers}
          subtitle="Registered & active"
          icon={Users}
          variant="primary"
          delay={1.6}
        />
        <StatCard
          title="Scans Today"
          value={totalScansToday}
          subtitle="Across all entry points"
          icon={Camera}
          variant={totalScansToday > 0 ? "primary" : "default"}
          flash={scansFlash}
          delay={2.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ComplianceChart incidents={incidents} />
        <GearBreakdownChart incidents={incidents} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <RecentIncidents incidents={incidents} />
        <DepartmentRiskBreakdown incidents={incidents} entryPoints={entryPoints} />
        <SafetyRiskSummary incidents={incidents} />
      </div>
    </div>
  );
}