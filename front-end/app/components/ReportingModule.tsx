import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { FileText, Download, Calendar, Filter, TrendingUp, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";

const API_BASE = 'http://localhost:5000/api';

interface DepartmentSummary {
  department: string;
  total_assets: number;
  in_use: number;
  available: number;
  utilization_percentage: number;
  total_value: number;
}

interface UtilizationTrend {
  asset_code: string;
  asset_name: string;
  category: string;
  avg_utilization: number;
  peak_hour: number;
  total_scans: number;
  idle_minutes: number;
  status: string;
}

interface MaintenanceHistory {
  asset_code: string;
  asset_name: string;
  vendor_name: string;
  maintenance_type: string;
  maintenance_start: string;
  maintenance_end?: string;
  maintenance_cost?: number;
  maintenance_hours?: number;
  department_name: string;
  status: string;
}

interface TCOSummary {
  category: string;
  asset_count: number;
  total_purchase_cost: number;
  total_maintenance_cost: number;
  total_tco: number;
  cost_per_asset: number;
}

interface QuickStats {
  total_asset_value: number;
  total_assets: number;
  avg_asset_age_months: number;
  reports_generated_this_month: number;
  scheduled_reports_count: number;
}

interface FinancialOverview {
  total_acquisition_cost: number;
  maintenance_cost_ytd: number;
  maintenance_cost_this_month: number;
}

export default function ReportingModule() {
  const [reportType, setReportType] = useState("department");
  const [timeRange, setTimeRange] = useState("month");
  const [loading, setLoading] = useState(false);

  // Data states
  const [departmentData, setDepartmentData] = useState<DepartmentSummary[]>([]);
  const [utilizationData, setUtilizationData] = useState<UtilizationTrend[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceHistory[]>([]);
  const [tcoData, setTCOData] = useState<TCOSummary[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStats>({
    total_asset_value: 0,
    total_assets: 0,
    avg_asset_age_months: 0,
    reports_generated_this_month: 0,
    scheduled_reports_count: 0
  });
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview>({
    total_acquisition_cost: 0,
    maintenance_cost_ytd: 0,
    maintenance_cost_this_month: 0
  });

  useEffect(() => {
    fetchQuickStats();
    fetchDepartmentSummary();
    fetchUtilizationTrends();
    fetchMaintenanceHistory();
    fetchTCOSummary();
    fetchFinancialOverview();
  }, []);

  useEffect(() => {
    if (timeRange) {
      fetchUtilizationTrends();
      fetchMaintenanceHistory();
    }
  }, [timeRange]);

  const fetchQuickStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/quick-stats`);
      const data = await response.json();
      // Convert string numbers to actual numbers
      setQuickStats({
        total_asset_value: parseFloat(data.total_asset_value || 0),
        total_assets: parseInt(data.total_assets || 0),
        avg_asset_age_months: parseFloat(data.avg_asset_age_months || 0),
        reports_generated_this_month: parseInt(data.reports_generated_this_month || 0),
        scheduled_reports_count: parseInt(data.scheduled_reports_count || 0)
      });
    } catch (error) {
      console.error('Error fetching quick stats:', error);
    }
  };

  const fetchDepartmentSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/department-summary`);
      const result = await response.json();
      // Convert string numbers to actual numbers
      const data = (result.data || []).map((dept: any) => ({
        ...dept,
        total_value: parseFloat(dept.total_value || 0),
        utilization_percentage: parseFloat(dept.utilization_percentage || 0)
      }));
      setDepartmentData(data);
    } catch (error) {
      console.error('Error fetching department summary:', error);
    }
  };

  const fetchUtilizationTrends = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/utilization-trends?time_range=${timeRange}`);
      const result = await response.json();
      setUtilizationData(result.data || []);
    } catch (error) {
      console.error('Error fetching utilization trends:', error);
    }
  };

  const fetchMaintenanceHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/maintenance-history?time_range=${timeRange}`);
      const result = await response.json();
      setMaintenanceData(result.data || []);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
    }
  };

  const fetchTCOSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/tco-summary`);
      const result = await response.json();
      // Convert string numbers to actual numbers
      const data = (result.data || []).map((item: any) => ({
        ...item,
        total_purchase_cost: parseFloat(item.total_purchase_cost || 0),
        total_maintenance_cost: parseFloat(item.total_maintenance_cost || 0),
        total_tco: parseFloat(item.total_tco || 0),
        cost_per_asset: parseFloat(item.cost_per_asset || 0)
      }));
      setTCOData(data);
    } catch (error) {
      console.error('Error fetching TCO summary:', error);
    }
  };

  const fetchFinancialOverview = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/financial-overview`);
      const data = await response.json();
      // Convert string numbers to actual numbers
      setFinancialOverview({
        total_acquisition_cost: parseFloat(data.total_acquisition_cost || 0),
        maintenance_cost_ytd: parseFloat(data.maintenance_cost_ytd || 0),
        maintenance_cost_this_month: parseFloat(data.maintenance_cost_this_month || 0)
      });
    } catch (error) {
      console.error('Error fetching financial overview:', error);
    }
  };

  const handleExportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: any) => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      let data: any[];
      let filename: string;
      
      switch(reportType) {
        case 'department':
          data = departmentData;
          filename = 'department_summary';
          break;
        case 'utilization':
          data = utilizationData;
          filename = 'utilization_trends';
          break;
        case 'maintenance':
          data = maintenanceData;
          filename = 'maintenance_history';
          break;
        case 'tco':
          data = tcoData;
          filename = 'tco_report';
          break;
        case 'missing':
          // Fetch missing assets report
          const response = await fetch(`${API_BASE}/reports/missing-assets?days=30`);
          const result = await response.json();
          data = result.data || [];
          filename = 'missing_assets';
          break;
        default:
          data = departmentData;
          filename = 'department_summary';
      }
      
      if (data && data.length > 0) {
        handleExportCSV(data, filename);
        alert(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully!`);
      } else {
        alert('No data available for this report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Reporting Module
          </h1>
          <p className="text-gray-600 mt-1">Generate comprehensive reports and analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => alert('Schedule report functionality coming soon')}>
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Report
          </Button>
          <Button onClick={() => alert('Export all functionality coming soon')}>
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
          <CardDescription>Configure and generate custom reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">Department Summary</SelectItem>
                  <SelectItem value="utilization">Utilization Trends</SelectItem>
                  <SelectItem value="maintenance">Maintenance History</SelectItem>
                  <SelectItem value="tco">Total Cost of Ownership</SelectItem>
                  <SelectItem value="missing">Lost/Missing Assets</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="quarter">Quarterly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleGenerateReport} 
                disabled={loading}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Asset Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">{formatCurrency(quickStats.total_asset_value)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all departments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Reports Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quickStats.reports_generated_this_month}</div>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Asset Age</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(quickStats.avg_asset_age_months)} mo</div>
            <p className="text-xs text-gray-500 mt-1">Average lifespan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Scheduled Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quickStats.scheduled_reports_count}</div>
            <p className="text-xs text-gray-500 mt-1">Active schedules</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Different Reports */}
      <Tabs defaultValue="department" className="space-y-4">
        <TabsList>
          <TabsTrigger value="department">Department Reports</TabsTrigger>
          <TabsTrigger value="utilization">Utilization Reports</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance Reports</TabsTrigger>
          <TabsTrigger value="financial">Financial Reports</TabsTrigger>
        </TabsList>

        {/* Department Summary Tab */}
        <TabsContent value="department">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Department Asset Summary</CardTitle>
                  <CardDescription>Asset distribution and value by department</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExportCSV(departmentData, 'department_summary')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Total Assets</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">In Use</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Available</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Utilization %</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      departmentData.map((dept: DepartmentSummary, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{dept.department}</td>
                          <td className="px-4 py-3">{dept.total_assets}</td>
                          <td className="px-4 py-3">{dept.in_use}</td>
                          <td className="px-4 py-3">{dept.available}</td>
                          <td className={`px-4 py-3 ${dept.utilization_percentage >= 70 ? "text-green-600 font-semibold" : "text-orange-600"}`}>
                            {dept.utilization_percentage.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3">{formatCurrency(dept.total_value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Utilization Trends Tab */}
        <TabsContent value="utilization">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Asset Utilization Trends</CardTitle>
                  <CardDescription>{timeRange} utilization analysis</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExportCSV(utilizationData, 'utilization_trends')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Asset Code</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Asset Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Avg Utilization</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Peak Hour</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Idle Time</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilizationData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      utilizationData.map((asset: UtilizationTrend, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{asset.asset_code}</td>
                          <td className="px-4 py-3">{asset.asset_name}</td>
                          <td className="px-4 py-3">{asset.category}</td>
                          <td className={`px-4 py-3 ${asset.avg_utilization >= 70 ? "text-green-600 font-semibold" : "text-orange-600"}`}>
                            {asset.avg_utilization}%
                          </td>
                          <td className="px-4 py-3">{asset.peak_hour}:00</td>
                          <td className="px-4 py-3">{(asset.idle_minutes / 60).toFixed(1)} hrs</td>
                          <td className="px-4 py-3">{asset.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance History Tab */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Maintenance History Report</CardTitle>
                  <CardDescription>Recent maintenance activities</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExportCSV(maintenanceData, 'maintenance_history')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Asset</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Vendor</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Start Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Duration</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Cost</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No maintenance records found
                        </td>
                      </tr>
                    ) : (
                      maintenanceData.map((record: MaintenanceHistory, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{record.asset_code}</div>
                            <div className="text-sm text-gray-500">{record.asset_name}</div>
                          </td>
                          <td className="px-4 py-3">{record.vendor_name || 'N/A'}</td>
                          <td className="px-4 py-3">{record.maintenance_type}</td>
                          <td className="px-4 py-3">{formatDate(record.maintenance_start)}</td>
                          <td className="px-4 py-3">{record.maintenance_hours?.toFixed(1) || '-'} hrs</td>
                          <td className="px-4 py-3">
                            {record.maintenance_cost ? formatCurrency(record.maintenance_cost) : '-'}
                          </td>
                          <td className="px-4 py-3">{record.department_name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={record.status === 'Completed' ? 'default' : 'secondary'}>
                              {record.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Reports Tab */}
        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Total Cost of Ownership (TCO) Report</CardTitle>
                  <CardDescription>Asset acquisition and operational costs</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExportCSV(tcoData, 'tco_report')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Financial Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Acquisition Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(financialOverview.total_acquisition_cost)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Maintenance Cost (YTD)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(financialOverview.maintenance_cost_ytd)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Maintenance Cost (This Month)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(financialOverview.maintenance_cost_this_month)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* TCO Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Asset Count</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Purchase Cost</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Maintenance Cost</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Total TCO</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Cost per Asset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tcoData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    ) : (
                      tcoData.map((item: TCOSummary, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{item.category}</td>
                          <td className="px-4 py-3">{item.asset_count}</td>
                          <td className="px-4 py-3">{formatCurrency(item.total_purchase_cost)}</td>
                          <td className="px-4 py-3">{formatCurrency(item.total_maintenance_cost)}</td>
                          <td className="px-4 py-3 font-semibold">{formatCurrency(item.total_tco)}</td>
                          <td className="px-4 py-3">{formatCurrency(item.cost_per_asset)}</td>
                        </tr>
                      ))
                    )}
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