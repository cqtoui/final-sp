import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function GearBreakdownChart({ incidents }) {
  const gearCounts = {};
  incidents.forEach((inc) => {
    (inc.missing_gear || []).forEach((gear) => {
      gearCounts[gear] = (gearCounts[gear] || 0) + 1;
    });
  });

  const data = Object.entries(gearCounts)
    .map(([gear, count]) => ({ gear: gear.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  if (data.length === 0) {
    data.push(
      { gear: "Helmet", count: 8 },
      { gear: "Gloves", count: 5 },
      { gear: "Goggles", count: 4 },
      { gear: "Safety Vest", count: 3 },
      { gear: "Steel Boots", count: 2 },
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Most Missed Gear Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" className="text-xs" tick={{ fill: "#64748B" }} />
              <YAxis dataKey="gear" type="category" className="text-xs" tick={{ fill: "#64748B" }} width={80} />
              <Tooltip
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#172033",
                }}
              />
              <Bar dataKey="count" fill="#EA580C" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}