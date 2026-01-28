import { useEffect, useMemo, useState } from "react";
import { Activity, Package, Layers, DollarSign, TrendingUp, RefreshCw, Search, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAPI, postAPI } from "../api/api";

/* ---------- Types ---------- */
type Asset = {
  asset_id: number;
  asset_code: string;
  asset_name: string;
  manufacturer?: string;
  model?: string;
  purchase_cost?: string | number;
  category_name?: string;
  department_name?: string;
};

type Department = {
  department_id: number;
  name: string;
};

export function AssetManagement() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_code: "",
    asset_name: "",
    manufacturer: "",
    model: "",
    purchase_cost: "",
    department_id: ""
  });

  /* ---------- Load Data ---------- */
  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsData, deptData] = await Promise.all([
        fetchAPI<Asset[]>("/assets"),
        fetchAPI<Department[]>("/assets/departments")
      ]);
      setAssets(assetsData);
      setDepartments(deptData);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ---------- Add Asset ---------- */
  const handleAddAsset = async () => {
    try {
      const result = await postAPI("/assets", {
        asset_code: newAsset.asset_code,
        asset_name: newAsset.asset_name,
        manufacturer: newAsset.manufacturer || null,
        model: newAsset.model || null,
        purchase_cost: newAsset.purchase_cost ? Number(newAsset.purchase_cost) : null,
        department_id: newAsset.department_id ? Number(newAsset.department_id) : null
      });
      
      console.log("Asset added successfully:", result);
      setIsAddDialogOpen(false);
      setNewAsset({
        asset_code: "",
        asset_name: "",
        manufacturer: "",
        model: "",
        purchase_cost: "",
        department_id: ""
      });
      loadData();
    } catch (error: any) {
      console.error("Failed to add asset:", error);
      console.error("Error details:", error.message);
      alert(`Failed to add asset: ${error.message}\n\nCheck Flask console for details.`);
    }
  };

  /* ---------- Stats (FIXED NUMBERS) ---------- */
  const stats = useMemo(() => {
    const totalAssets = assets.length;
    const totalValue = assets.reduce((sum, asset) => {
      const cost = Number(asset.purchase_cost);
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
    const categories = new Set(assets.map(a => a.category_name).filter(Boolean));
    const departments = new Set(assets.map(a => a.department_name).filter(Boolean));

    return [
      {
        title: "Total Assets",
        value: totalAssets,
        icon: <Package className="w-5 h-5" />,
        trend: `${categories.size} categories`,
        color: "bg-blue-500",
      },
      {
        title: "Total Value",
        value: `$${(totalValue / 1000).toFixed(1)}K`,
        icon: <DollarSign className="w-5 h-5" />,
        trend: `Avg: $${totalAssets ? (totalValue / totalAssets).toFixed(0) : 0}`,
        color: "bg-green-500",
      },
      {
        title: "Departments",
        value: departments.size,
        icon: <Layers className="w-5 h-5" />,
        trend: "Assigned locations",
        color: "bg-orange-500",
      },
      {
        title: "Categories",
        value: categories.size,
        icon: <Activity className="w-5 h-5" />,
        trend: "Asset types",
        color: "bg-purple-500",
      }
    ];
  }, [assets]);

  /* ---------- Charts ---------- */
  const categoryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach(a => {
      const key = a.category_name || "Uncategorized";
      map[key] = (map[key] || 0) + 1;
    });
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    return Object.entries(map).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length]
    }));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(a =>
      a.asset_code.toLowerCase().includes(q) ||
      a.asset_name.toLowerCase().includes(q) ||
      (a.department_name && a.department_name.toLowerCase().includes(q))
    );
  }, [assets, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Asset Management</h1>
          <p className="text-gray-500">Organization-wide assets overview</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Asset</DialogTitle>
              <DialogDescription>Asset details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {["asset_code", "asset_name", "manufacturer", "model", "purchase_cost"].map(field => (
                <div key={field}>
                  <Label className="capitalize">{field.replace("_", " ")}</Label>
                  <Input
                    value={newAsset[field as keyof typeof newAsset]}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, [field]: e.target.value })
                    }
                  />
                </div>
              ))}
              {/* Department Dropdown */}
              <div>
                <Label>Department</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={newAsset.department_id}
                  onChange={(e) =>
                    setNewAsset({ ...newAsset, department_id: e.target.value })
                  }
                >
                  <option value="">All Departments (No Restriction)</option>
                  {departments.map(dep => (
                    <option key={dep.department_id} value={dep.department_id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddAsset}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{s.title}</p>
                  <h3 className="text-2xl font-bold mt-1">{s.value}</h3>
                  <p className="text-xs text-gray-400 mt-1">{s.trend}</p>
                </div>
                <div className={`${s.color} p-3 rounded-lg text-white`}>
                  {s.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Pie */}
      <Card>
        <CardHeader>
          <CardTitle>Assets by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {categoryDistribution.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Asset Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Assets</CardTitle>
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2"
          />
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Department</th>
                <th className="text-left p-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map(a => (
                <tr key={a.asset_id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{a.asset_code}</td>
                  <td className="p-2">{a.asset_name}</td>
                  <td className="p-2">{a.department_name || "—"}</td>
                  <td className="p-2">
                    {a.purchase_cost
                      ? `$${Number(a.purchase_cost).toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}