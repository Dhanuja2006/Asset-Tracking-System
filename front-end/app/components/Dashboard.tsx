import { useEffect, useMemo, useState } from "react";
import { fetchAPI } from "../api/api";
import { DashboardStats } from "./DashboardStats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { AlertTriangle, MapPin, Wifi, Clock } from "lucide-react";

/* ---------- Types ---------- */
type DashboardAsset = {
  asset_id: number;
  asset_code: string;
  asset_name: string;
  activity_status: "Active" | "Idle" | "Missing";
};

type AlertItem = {
  alert_id: number;
  alert_type: string;
  alert_message: string;
  asset_code: string;
  asset_name: string;
  hours_open: number | string;
};

type Reader = {
  reader_id: number;
  reader_code: string;
  room_name: string | null;
  status: "Online" | "Warning" | "Offline";
  last_heartbeat: string;
};

export function Dashboard() {
  const [assets, setAssets] = useState<DashboardAsset[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [readers, setReaders] = useState<Reader[]>([]);

  /* ---------- Load data ---------- */
  useEffect(() => {
    fetchAPI<DashboardAsset[]>("/dashboard").then(setAssets).catch(() => setAssets([]));
    fetchAPI<AlertItem[]>("/alerts").then(setAlerts).catch(() => setAlerts([]));
    fetchAPI<Reader[]>("/readers").then(setReaders).catch(() => setReaders([]));
  }, []);

  /* ---------- Helpers ---------- */
  const formatTimeAgo = (ts: string) => {
    if (!ts) return "—";
    const hrs = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000);
    if (hrs < 1) return "Just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const assetStatusDistribution = useMemo(() => {
    const counts = { Active: 0, Idle: 0, Missing: 0 };
    assets.forEach(a => counts[a.activity_status]++);
    return [
      { name: "Idle", value: counts.Active, color: "#22c55e" },
      { name: "Active", value: counts.Idle, color: "#22c55e" },
      { name: "Missing", value: counts.Missing, color: "#ef4444" },
    ];
  }, [assets]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview</p>
      </div>

      <DashboardStats />

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Asset Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={assetStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={e => e.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {assetStatusDistribution.map((e, i) => (
                    <Cell key={`cell-${i}`} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RFID Readers</CardTitle>
            <CardDescription>Total: {readers.length}</CardDescription>
          </CardHeader>
          <CardContent>
            {readers.length === 0 && <div className="text-muted-foreground">No readers found</div>}
            {readers.map(r => (
              <div key={r.reader_id} className="flex items-center gap-2 py-2 border-b last:border-0">
                <Wifi className="w-4 h-4" />
                {r.reader_code}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 && <div className="text-muted-foreground">No alerts</div>}
          {alerts.map(a => {
            const hours = Number(a.hours_open) || 0;
            return (
              <div key={a.alert_id} className="flex items-start gap-3 py-3 border-b last:border-0">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.alert_type}</span>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      {hours.toFixed(1)}h
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.alert_message}</p>
                  <p className="text-xs text-muted-foreground">{a.asset_code} – {a.asset_name}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}