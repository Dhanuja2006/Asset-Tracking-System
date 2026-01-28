import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899"
];

export function UtilizationAnalytics() {
  const [assets, setAssets] = useState<any[]>([]);
  const [peakHourDeptData, setPeakHourDeptData] = useState<any[]>([]);
  const [dailyDeptData, setDailyDeptData] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/utilization/assets")
      .then(res => res.json())
      .then(setAssets);

    // 🔥 Peak Hour Utilization
    fetch("http://localhost:5000/api/utilization/peak-hours-by-department")
      .then(res => res.json())
      .then(raw => {
        const grouped: any = {};

        raw.forEach((row: any) => {
          const hour = `${row.hour}:00`;
          if (!grouped[hour]) grouped[hour] = { hour };
          grouped[hour][row.department_name] = Number(row.scan_count);
        });

        setPeakHourDeptData(Object.values(grouped));
      })
      .catch(console.error);

    // Daily department-wise utilization
    fetch("http://localhost:5000/api/utilization/daily-by-department")
      .then(res => res.json())
      .then(raw => {
        const grouped: any = {};
        raw.forEach((r: any) => {
          if (!grouped[r.day]) grouped[r.day] = { day: r.day };
          grouped[r.day][r.department_name] = Number(r.utilization);
        });
        setDailyDeptData(Object.values(grouped));
      });

    // Category distribution
    fetch("http://localhost:5000/api/assets/category-distribution")
      .then(res => res.json())
      .then(setCategoryDistribution);
  }, []);

  const avgUtilization =
    assets.length > 0
      ? assets.reduce((s, a) => s + Number(a.utilization_rate), 0) / assets.length
      : 0;

  const underUtilized = assets.filter(a => a.utilization_rate < 50).length;
  const peakUtilization = assets.length
    ? Math.max(...assets.map(a => Number(a.utilization_rate)))
    : 0;

  const badgeClass = (rate: number) =>
    rate >= 80
      ? "bg-green-100 text-green-800"
      : rate >= 50
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  return (
    <div style={{ padding: "1rem" }}>

      <h2 style={{ fontSize: "1.8rem", fontWeight: 700 }}>
        Asset Utilization & Analytics
      </h2>

      {/* KPI CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "1rem",
        marginBottom: "1.5rem"
      }}>
        <Card><CardContent><b>{avgUtilization.toFixed(1)}%</b><p>Average Utilization</p></CardContent></Card>
        <Card><CardContent><b>{underUtilized}</b><p>Under-Utilized Assets</p></CardContent></Card>
        <Card><CardContent><b>{peakUtilization}%</b><p>Peak Utilization</p></CardContent></Card>
      </div>

      <Card style={{ marginBottom: "1.5rem" }}>
        <CardHeader>
          <CardTitle>Peak Hour Utilization Across Departments</CardTitle>
          <CardDescription>
            Scan activity by hour and department (last 7 days)
          </CardDescription>
        </CardHeader>

        <CardContent>
          {peakHourDeptData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={peakHourDeptData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />

                {Object.keys(peakHourDeptData[0])
                  .filter(k => k !== "hour")
                  .map((dept, idx) => (
                    <Bar
                      key={dept}
                      dataKey={dept}
                      stackId="a"
                      fill={COLORS[idx % COLORS.length]}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 🔥 DAILY + CATEGORY SIDE BY SIDE */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: window.innerWidth < 900 ? "1fr" : "1fr 1fr",
          gap: "1.5rem"
        }}
      >
        {/* DAILY UTILIZATION */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Utilization Pattern</CardTitle>
            <CardDescription>Department-wise per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyDeptData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                {dailyDeptData.length > 0 &&
                  Object.keys(dailyDeptData[0])
                    .filter(k => k !== "day")
                    .map((dept, i) => (
                      <Bar
                        key={dept}
                        dataKey={dept}
                        stackId="a"
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CATEGORY DISTRIBUTION */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Utilization by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {categoryDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ASSET TABLE */}
      <Card style={{ marginTop: "1.5rem" }}>
        <CardHeader>
          <CardTitle>Asset-wise Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(a => (
                <TableRow key={a.asset_id}>
                  <TableCell>{a.asset_code}</TableCell>
                  <TableCell>{a.asset_name}</TableCell>
                  <TableCell>{a.department_name ?? "—"}</TableCell>
                  <TableCell><Progress value={a.utilization_rate} /></TableCell>
                  <TableCell>
                    <Badge className={badgeClass(a.utilization_rate)}>
                      {a.utilization_rate >= 80 ? "Optimal" : a.utilization_rate >= 50 ? "Moderate" : "Low"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
