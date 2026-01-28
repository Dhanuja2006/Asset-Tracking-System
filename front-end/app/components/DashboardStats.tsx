import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { fetchAPI } from "../api/api";

/* ---------- Types ---------- */
type Asset = {
  asset_id: number;
};

type DashboardAsset = {
  activity_status: "Active" | "Idle" | "Missing";
};

type AlertItem = {
  alert_id: number;
};

type Reader = {
  reader_id: number;
  status: "Online" | "Warning" | "Offline";
};

/* ---------- Stat interface ---------- */
interface Stat {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color: string;
}

export function DashboardStats() {
  /* ---------- State ---------- */
  const [totalAssets, setTotalAssets] = useState(0);
  const [activeAssets, setActiveAssets] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [totalReaders, setTotalReaders] = useState(0);

  /* ---------- Fetch all stats ---------- */
  useEffect(() => {
    // Total assets
    fetchAPI<Asset[]>("/assets").then(data => {
      setTotalAssets(data.length);
    });

    // Active assets
    fetchAPI<DashboardAsset[]>("/dashboard").then(data => {
      setActiveAssets(data.filter(a => a.activity_status === "Active").length);
    });

    // Active alerts
    fetchAPI<AlertItem[]>("/alerts").then(data => {
      setActiveAlerts(data.length);
    });

    // Total readers
    fetchAPI<Reader[]>("/readers").then(data => {
      setTotalReaders(data.length);
    });
  }, []);

  /* ---------- Stats config ---------- */
  const stats: Stat[] = [
    {
      title: "Total Assets",
      value: totalAssets,
      icon: <Package className="h-5 w-5" />,
      trend: `${totalAssets} registered`,
      trendUp: true,
      color: "text-blue-600"
    },
    {
      title: "Active Assets",
      value: activeAssets,
      icon: <Activity className="h-5 w-5" />,
      trend: `${totalAssets ? Math.round((activeAssets / totalAssets) * 100) : 0}% in use`,
      trendUp: true,
      color: "text-green-600"
    },
    {
      title: "Active Alerts",
      value: activeAlerts,
      icon: <AlertTriangle className="h-5 w-5" />,
      trend: "Needs attention",
      trendUp: false,
      color: "text-orange-600"
    },
    {
      title: "Total Readers",
      value: totalReaders,
      icon: <CheckCircle className="h-5 w-5" />,
      trend: `${totalReaders} configured`,
      trendUp: true,
      color: "text-purple-600"
    }
  ];

  /* ---------- JSX ---------- */
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <div className={stat.color}>{stat.icon}</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            {stat.trend && (
              <p
                className={`text-xs mt-1 ${
                  stat.trendUp ? "text-green-600" : "text-orange-600"
                }`}
              >
                {stat.trend}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}