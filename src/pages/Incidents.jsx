import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import IncidentRow from "../components/incidents/IncidentRow";
import IncidentDetailDialog from "../components/incidents/IncidentDetailDialog";
import PasswordConfirmDialog from "../components/auth/PasswordConfirmDialog";
import { calculateComplianceRate, findWorkerForIncident } from "@/lib/compliance";
import { toast } from "sonner";

export default function Incidents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => appClient.entities.Incident.list("-created_date"),
  });

  const deleteIncident = useMutation({
    mutationFn: async (incident) => {
      const incidentId = String(incident?.id ?? "").trim();
      if (!incidentId || incidentId === "undefined" || incidentId === "null") {
        throw new Error("Cannot delete an incident without an ID.");
      }

      await appClient.entities.Incident.delete(incidentId);

      const [workers, remainingIncidents] = await Promise.all([
        appClient.entities.Worker.list(),
        appClient.entities.Incident.list("-created_date"),
      ]);
      const worker = findWorkerForIncident(workers, incident);
      if (worker) {
        const remainingViolations = remainingIncidents.filter(
          (item) => findWorkerForIncident([worker], item)?.id === worker.id
        ).length;
        await appClient.entities.Worker.update(worker.id, {
          total_violations: remainingViolations,
          compliance_rate: calculateComplianceRate(remainingViolations),
        });
      }

      return { success: true };
    },
    onMutate: async (incident) => {
      const incidentId = String(incident?.id ?? "").trim();
      await queryClient.cancelQueries({ queryKey: ["incidents"] });
      const previous = queryClient.getQueryData(["incidents"]);
      queryClient.setQueryData(["incidents"], (current = []) =>
        current.filter((item) => String(item?.id) !== incidentId)
      );
      if (String(selectedIncident?.id) === incidentId) {
        setSelectedIncident(null);
      }
      return { previous, incidentId };
    },
    onSuccess: () => {
      toast.success("Incident deleted");
    },
    onError: (error, _incident, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["incidents"], context.previous);
      }
      toast.error(error?.message || "Incident could not be deleted.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
  });

  const resolveIncident = useMutation({
    mutationFn: (incident) =>
      appClient.entities.Incident.update(incident.id, {
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast.success("Incident resolved");
    },
  });

  const filtered = incidents.filter((inc) => {
    const matchSearch = !search || 
      inc.worker_name?.toLowerCase().includes(search.toLowerCase()) ||
      inc.department?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || (inc.status || "open") === statusFilter;
    const matchSeverity = severityFilter === "all" || (inc.severity || "medium") === severityFilter;
    return matchSearch && matchStatus && matchSeverity;
  });

  return (
    <div className="mx-auto max-w-[1600px] p-5 lg:p-7">
      <PageHeader title="Incidents" subtitle={`${incidents.length} total incidents recorded`} />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            name="incident-search"
            autoComplete="off"
            placeholder="Search worker or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Worker</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Missing Gear</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading incidents...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No incidents found</TableCell>
                </TableRow>
              ) : (
                filtered.map((inc, index) => (
                  <IncidentRow
                    key={inc.id || `${inc.incident_time || inc.created_date || "incident"}-${index}`}
                    incident={inc}
                    onResolve={(row) => resolveIncident.mutate(row)}
                    onView={(row) => setSelectedIncident(row)}
                    onDelete={(row) => setPendingDelete(row)}
                    isDeleting={
                      deleteIncident.isPending &&
                      String(deleteIncident.variables?.id) === String(inc.id)
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <IncidentDetailDialog
        incident={selectedIncident}
        open={!!selectedIncident}
        onOpenChange={(open) => !open && setSelectedIncident(null)}
      />

      <PasswordConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this incident?"
        description={`This will permanently delete the selected incident for ${pendingDelete?.worker_name || "this worker"}. Other incidents will not be changed. Enter the admin password to confirm.`}
        confirmLabel="Delete incident"
        destructive
        onConfirm={() => {
          if (pendingDelete) {
            deleteIncident.mutate(pendingDelete);
          }
        }}
      />
    </div>
  );
}