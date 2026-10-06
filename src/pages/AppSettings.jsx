// @ts-nocheck

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardHat, Glasses, Shield, Camera, Bell, Database, Hand, Headphones, Shirt } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import AdminSecuritySettings from "../components/settings/AdminSecuritySettings";

export default function AppSettings() {
  return (
    <div className="mx-auto max-w-[1600px] p-5 lg:p-7">
      <PageHeader title="Settings" subtitle="Configure your AI SafeGuard system" />

      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Row 1: Gear Detection (left) + Camera Configuration (right) */}
        <Card className="min-w-0 border shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4" /> Gear Detection Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Reference only. Required gear is set per workplace on Entry Points — these rows are not toggles.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3">
              {[
                { name: "Helmet", icon: HardHat, required: true },
                { name: "Safety Goggles", icon: Glasses, required: true },
                { name: "Safety Vest", icon: Shirt, required: true },
                { name: "Gloves", icon: Hand, required: true },
                { name: "Ear Protection", icon: Headphones, required: false },
                { name: "Lab Coat", icon: Shield, required: false },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <Badge className={item.required ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}>
                    {item.required ? "Required" : "Optional"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Camera className="w-4 h-4" /> Camera Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              Live Monitor scan pipeline. Informational only — values cannot be changed here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Scan trigger", value: "Manual" },
                { label: "Camera preview", value: "Mirrored" },
                { label: "PPE model", value: "YOLO11s v6" },
                { label: "Detection size", value: "960 px" },
                { label: "Confidence", value: "0.25" },
                { label: "Scan timeout", value: "11.5 s" },
                { label: "Face detection", value: "YuNet" },
                { label: "Face model", value: "Facenet512" },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
                  <p className="mt-1 text-sm font-semibold">{row.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground mb-1">Best scan quality</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Face the camera in even lighting and keep helmet, goggles, vest, gloves, and any other required gear fully visible in the frame.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-w-0 grid-cols-1 items-stretch gap-6 lg:col-span-2 lg:grid-cols-2">
        {/* Row 2: Alert Settings (left) + Admin Security (right) */}
        <Card className="flex h-full flex-col border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4" /> Alert Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Informational defaults. These are not toggles.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm">Sound alerts</span>
              <Badge className="bg-emerald-100 text-emerald-700">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm">Auto-escalate after</span>
              <Badge variant="outline">30 minutes</Badge>
            </div>
          </CardContent>
        </Card>

        <AdminSecuritySettings />
        </div>
      </div>

      {/* System Info — full width at bottom */}
      <Card className="border shadow-sm mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="w-4 h-4" /> System Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex justify-between items-center p-3 rounded-lg border">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="font-mono text-sm">1.0.0</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg border">
              <span className="text-sm text-muted-foreground">AI Model</span>
              <span className="font-mono text-sm">YOLO11s v6</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg border">
              <span className="text-sm text-muted-foreground">Detection Engine</span>
              <span className="font-mono text-sm">YOLO + Facenet512</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}