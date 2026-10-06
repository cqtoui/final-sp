import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sun, User, ShieldCheck } from "lucide-react";

const GUIDE_ITEMS = [
  {
    icon: Sun,
    title: "Even lighting",
    text: "Stand in clear, even light. Avoid heavy shadows on the face and gear.",
  },
  {
    icon: User,
    title: "Face the camera",
    text: "Look toward the lens so face identification can run with the PPE check.",
  },
  {
    icon: ShieldCheck,
    title: "Show all gear",
    text: "Keep every required item fully visible in the frame before you scan.",
  },
];

export default function DetectionGuide() {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border shadow-sm">
      <CardHeader className="shrink-0 pb-2 pt-4">
        <CardTitle className="text-base font-semibold">Before you scan</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col justify-evenly gap-3 pb-4">
        {GUIDE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
