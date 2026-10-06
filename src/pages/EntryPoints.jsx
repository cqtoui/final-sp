import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, MapPin, Camera, Wifi, WifiOff, Edit, Trash2, Loader2 } from "lucide-react";
import PasswordConfirmDialog from "../components/auth/PasswordConfirmDialog";
import PageHeader from "../components/layout/PageHeader";
import { toast } from "sonner";

const DEPARTMENTS = [
  { value: "assembly", label: "Assembly" },
  { value: "electrical", label: "Electrical" },
  { value: "warehouse", label: "Warehouse" },
  { value: "chemical_lab", label: "Chemical Lab" },
  { value: "maintenance", label: "Maintenance" },
];

const GEAR_OPTIONS = [
  "helmet", "goggles", "safety_vest", "gloves",
  "ear_protection", "lab_coat",
];

const statusColors = {
  online: "bg-emerald-100 text-emerald-700",
  offline: "bg-red-100 text-red-700",
  maintenance: "bg-amber-100 text-amber-700",
};

export default function EntryPoints() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", location: "", department: "warehouse", camera_status: "online", required_gear: ["helmet", "goggles", "safety_vest", "gloves"] });
  const [pwDialog, setPwDialog] = useState(null);
  const queryClient = useQueryClient();

  const { data: entryPoints = [], isLoading } = useQuery({
    queryKey: ["entryPoints"],
    queryFn: () => appClient.entities.EntryPoint.list(),
  });

  const createEP = useMutation({
    mutationFn: (data) => appClient.entities.EntryPoint.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["entryPoints"] }); setDialogOpen(false); toast.success("Entry point added"); },
  });

  const updateEP = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.EntryPoint.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["entryPoints"] }); setDialogOpen(false); setEditing(null); toast.success("Entry point updated"); },
  });

  const deleteEP = useMutation({
    mutationFn: (id) => appClient.entities.EntryPoint.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["entryPoints"] }); toast.success("Entry point deleted"); },
  });

  const openForm = (ep) => {
    if (ep) {
      setEditing(ep);
      setForm({ name: ep.name, location: ep.location || "", department: ep.department || "warehouse", camera_status: ep.camera_status || "online", required_gear: ep.required_gear || [] });
    } else {
      setEditing(null);
      setForm({ name: "", location: "", department: "warehouse", camera_status: "online", required_gear: ["helmet", "goggles", "safety_vest", "gloves"] });
    }
    setDialogOpen(true);
  };

  const toggleGear = (gear) => {
    setForm((prev) => ({ ...prev, required_gear: prev.required_gear.includes(gear) ? prev.required_gear.filter((g) => g !== gear) : [...prev.required_gear, gear] }));
  };

  const handleSave = () => {
    if (editing) updateEP.mutate({ id: editing.id, data: form });
    else createEP.mutate(form);
  };

  return (
    <div className="mx-auto max-w-[1600px] p-5 lg:p-7">
      <PageHeader title="Entry Points" subtitle="Manage camera entry points and their gear requirements">
        <Button onClick={() => openForm(null)}>
          <Plus className="w-4 h-4 mr-2" /> Add Entry Point
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : entryPoints.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No entry points configured yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {entryPoints.map((ep) => (
            <Card key={ep.id} className="border shadow-sm hover:shadow-md transition-all group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sidebar flex items-center justify-center">
                      <Camera className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{ep.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {ep.location || "No location set"}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColors[ep.camera_status || "online"]}>
                    {ep.camera_status === "online" ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                    {ep.camera_status || "online"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Dept: <span className="capitalize font-medium text-foreground">{ep.department?.replace(/_/g, " ") || "—"}</span>
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(ep.required_gear || []).map((gear) => (
                    <Badge key={gear} variant="outline" className="text-[10px]">{gear.replace(/_/g, " ")}</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPwDialog({ type: "edit", ep })}>
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setPwDialog({ type: "delete", ep })}>
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Entry Point" : "Add Entry Point"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Gate A" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Building 1, Floor 1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Camera Status</Label>
                <Select value={form.camera_status} onValueChange={(v) => setForm({ ...form, camera_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Required Gear</Label>
              <div className="grid grid-cols-2 gap-2">
                {GEAR_OPTIONS.map((gear) => (
                  <label key={gear} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={form.required_gear.includes(gear)} onCheckedChange={() => toggleGear(gear)} />
                    <span className="text-sm capitalize">{gear.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || createEP.isPending || updateEP.isPending}>
              {(createEP.isPending || updateEP.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={!!pwDialog}
        onOpenChange={(o) => !o && setPwDialog(null)}
        title={pwDialog?.type === "edit" ? "Admin Verification — Edit Entry Point" : "Admin Verification — Delete Entry Point"}
        description={pwDialog?.type === "edit"
          ? "Enter the admin password to edit this entry point."
          : "Enter the admin password to delete this entry point."}
        confirmLabel="Unlock"
        destructive={pwDialog?.type === "delete"}
        onConfirm={() => {
          if (pwDialog?.type === "edit") {
            openForm(pwDialog.ep);
          } else {
            deleteEP.mutate(pwDialog.ep.id);
          }
        }}
      />
    </div>
  );
}