import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Check,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type AlertItem = {
  alert_id: number;
  alert_type: string;
  alert_message: string;
  generated_at: string;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
  asset_code: string;
  asset_name: string;
  department_name: string | null;
  hours_open: number;
};

type Statistics = {
  active_count: number;
  acknowledged_count: number;
  unknown_assets: number;
  geofencing_alerts: number;
};

const getAlertIcon = (type: string): React.ReactNode => {
  if (type === "Unknown Asset") {
    return <AlertCircle className="h-5 w-5" />;
  }
  return <AlertTriangle className="h-5 w-5" />;
};

const getAlertColor = (type: string) => {
  if (type === "Unknown Asset") {
    return "border-purple-500";
  }
  return "border-orange-500";
};

const getPriorityBadge = (hoursOpen: number) => {
  if (hoursOpen > 12)
    return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
  if (hoursOpen > 6)
    return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
};

export function AlertsNotifications() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedAlerts, setSelectedAlerts] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/alerts?status=${activeTab}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      const data = text ? JSON.parse(text) : [];
      const normalizedData = data.map((alert: AlertItem) => ({
        ...alert,
        hours_open: Number(alert.hours_open) || 0
      }));
      setAlerts(normalizedData);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      setAlerts([]);
    }
    setIsLoading(false);
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/alerts/statistics");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      setStatistics(data);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      setStatistics(null);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchStatistics();
    const interval = setInterval(() => {
      fetchAlerts();
      fetchStatistics();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleAcknowledge = async (alertId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged_by: 1 }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log("Alert acknowledged successfully:", result);
        fetchAlerts();
        fetchStatistics();
      } else {
        console.error("Failed to acknowledge alert:", result);
        alert(`Failed to acknowledge: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      alert("Network error while acknowledging alert");
    }
  };

  const handleBulkAcknowledge = async () => {
    if (selectedAlerts.length === 0) return;
    try {
      const response = await fetch("http://localhost:5000/api/alerts/bulk-acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_ids: selectedAlerts,
          acknowledged_by: 1,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log("Alerts acknowledged successfully:", result);
        setSelectedAlerts([]);
        fetchAlerts();
        fetchStatistics();
      } else {
        console.error("Failed to bulk acknowledge:", result);
        alert(`Failed to acknowledge: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error("Error bulk acknowledging:", error);
      alert("Network error while bulk acknowledging alerts");
    }
  };

  const toggleSelectAlert = (alertId: number) => {
    setSelectedAlerts(prev =>
      prev.includes(alertId)
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    );
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch =
      alert.asset_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.alert_message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || alert.alert_type === filterType;
    return matchesSearch && matchesType;
  });

  const activeAlerts = filteredAlerts.filter(a => !a.acknowledged_at);
  const acknowledgedAlerts = filteredAlerts.filter(a => a.acknowledged_at);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Alerts & Notifications
          </h2>
          <p className="text-muted-foreground">
            Monitor geofencing violations and unknown asset scans
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            fetchAlerts();
            fetchStatistics();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.active_count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.acknowledged_count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2">
            <CardTitle className="text-sm font-medium">Unknown Assets</CardTitle>
            <AlertCircle className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.unknown_assets || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2">
            <CardTitle className="text-sm font-medium">Geofencing Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.geofencing_alerts || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by asset code, name, or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-52">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Unknown Asset">Unknown Asset</SelectItem>
                <SelectItem value="Geofencing Alert">Geofencing Alert</SelectItem>
              </SelectContent>
            </Select>
            {selectedAlerts.length > 0 && (
              <Button onClick={handleBulkAcknowledge}>
                <Check className="mr-2 h-4 w-4" />
                Acknowledge Selected ({selectedAlerts.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-96">
          <TabsTrigger value="active">
            Active ({statistics?.active_count || 0})
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Acknowledged ({statistics?.acknowledged_count || 0})
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-muted-foreground">No active alerts at the moment</p>
              </CardContent>
            </Card>
          ) : (
            activeAlerts.map(alert => (
              <Card
                key={alert.alert_id}
                className={`border-l-4 ${getAlertColor(alert.alert_type)}`}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="flex gap-4 items-start flex-1 min-w-64">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.includes(alert.alert_id)}
                        onChange={() => toggleSelectAlert(alert.alert_id)}
                        className="mt-1 h-5 w-5 rounded"
                      />
                      {getAlertIcon(alert.alert_type)}
                      <div className="flex-1">
                        <h3 className="font-semibold">{alert.alert_type}</h3>
                        <p className="text-sm text-muted-foreground">{alert.alert_message}</p>
                        <p className="text-sm mt-2">
                          {alert.asset_code} – {alert.asset_name}
                        </p>
                        {alert.department_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Department: {alert.department_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {getPriorityBadge(alert.hours_open)}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledge(alert.alert_id)}
                      >
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="acknowledged">
          <Card>
            <CardContent className="p-6">
              {acknowledgedAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <XCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-muted-foreground">No acknowledged alerts yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Asset</th>
                        <th className="text-left p-3 font-medium">Department</th>
                        <th className="text-left p-3 font-medium">Generated</th>
                        <th className="text-left p-3 font-medium">Acknowledged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acknowledgedAlerts.map(alert => (
                        <tr key={alert.alert_id} className="border-b hover:bg-slate-50">
                          <td className="p-3">{alert.alert_type}</td>
                          <td className="p-3">{alert.asset_code}</td>
                          <td className="p-3">{alert.department_name || "—"}</td>
                          <td className="p-3">{new Date(alert.generated_at).toLocaleString()}</td>
                          <td className="p-3">
                            {alert.acknowledged_at
                              ? new Date(alert.acknowledged_at).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">ID</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Asset</th>
                      <th className="text-left p-3 font-medium">Generated</th>
                      <th className="text-left p-3 font-medium">Hours Open</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map(alert => (
                      <tr key={alert.alert_id} className="border-b hover:bg-slate-50">
                        <td className="p-3">#{alert.alert_id}</td>
                        <td className="p-3">{alert.alert_type}</td>
                        <td className="p-3">{alert.asset_code}</td>
                        <td className="p-3">{new Date(alert.generated_at).toLocaleString()}</td>
                        <td className="p-3">{alert.hours_open.toFixed(1)}h</td>
                        <td className="p-3">
                          {alert.acknowledged_at ? (
                            <Badge className="bg-green-100 text-green-800">
                              Acknowledged
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              Active
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}