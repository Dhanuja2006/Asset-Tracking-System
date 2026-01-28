import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Edit,
  Filter,
  Search,
  DollarSign,
  Trash2,
} from 'lucide-react';

interface MaintenanceRecord {
  maintenance_id: number;
  asset_id: number;
  asset_code?: string;
  asset_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  maintenance_type: string;
  description: string;
  maintenance_start: string;
  maintenance_end?: string;
  maintenance_cost?: number;
  recorded_by: number;
  recorded_at: string;
  status: string;
  days_until_due?: number;
}

interface Asset {
  asset_id: number;
  asset_code: string;
  asset_name: string;
  category_id: number;
}

interface Vendor {
  vendor_id: number;
  vendor_name: string;
  contact_person: string;
  phone: string;
  email: string;
}

interface MaintenanceStats {
  overdue: number;
  due_this_week: number;
  total_pending: number;
  completed_this_month: number;
  total_cost_completed?: number;
}

const API_BASE = 'http://localhost:5000/api';

export default function MaintenanceScheduling() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stats, setStats] = useState<MaintenanceStats>({
    overdue: 0,
    due_this_week: 0,
    total_pending: 0,
    completed_this_month: 0,
    total_cost_completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [formData, setFormData] = useState({
    asset_id: '',
    vendor_id: '',
    maintenance_type: '',
    description: '',
    scheduled_date: '',
    maintenance_cost: '',
    recorded_by: 1
  });
  const [postponeData, setPostponeData] = useState({
    new_date: '',
    reason: ''
  });
  const [completeData, setCompleteData] = useState({
    completion_date: new Date().toISOString().split('T')[0],
    maintenance_cost: ''
  });

  useEffect(() => {
    fetchMaintenanceRecords();
    fetchAssets();
    fetchVendors();
    fetchStats();
  }, [filterStatus]);

  useEffect(() => {
    if (assetSearch.trim() === '') {
      setFilteredAssets([]);
    } else {
      const filtered = assets.filter(asset => 
        asset.asset_code.toLowerCase().includes(assetSearch.toLowerCase()) ||
        asset.asset_name.toLowerCase().includes(assetSearch.toLowerCase())
      );
      setFilteredAssets(filtered);
    }
  }, [assetSearch, assets]);

  const fetchMaintenanceRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/maintenance/all?status=${filterStatus}`);
      const data = await response.json();
      setRecords(data.data || []);
    } catch (error) {
      console.error('Error fetching maintenance records:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const response = await fetch(`${API_BASE}/assets`);
      const data = await response.json();
      setAssets(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch(`${API_BASE}/vendors`);
      const data = await response.json();
      setVendors(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/maintenance/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleScheduleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.asset_id) {
      alert('Please select an asset');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        maintenance_cost: formData.maintenance_cost ? parseFloat(formData.maintenance_cost) : null
      };

      const response = await fetch(`${API_BASE}/maintenance/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        alert('Maintenance scheduled successfully!');
        setShowScheduleModal(false);
        setFormData({
          asset_id: '',
          vendor_id: '',
          maintenance_type: '',
          description: '',
          scheduled_date: '',
          maintenance_cost: '',
          recorded_by: 1
        });
        setAssetSearch('');
        fetchMaintenanceRecords();
        fetchStats();
      } else {
        const errorData = await response.json();
        alert(`Failed to schedule maintenance: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error scheduling maintenance:', error);
      alert('Error scheduling maintenance');
    }
  };

  const handleAssetSelect = (asset: Asset) => {
    setFormData({ ...formData, asset_id: asset.asset_id.toString() });
    setAssetSearch(`${asset.asset_code} - ${asset.asset_name}`);
    setShowAssetDropdown(false);
  };

  const handlePostponeMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const response = await fetch(`${API_BASE}/maintenance/postpone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenance_id: selectedRecord.maintenance_id,
          ...postponeData
        })
      });
      
      if (response.ok) {
        alert('Maintenance postponed successfully!');
        setShowPostponeModal(false);
        setSelectedRecord(null);
        setPostponeData({ new_date: '', reason: '' });
        fetchMaintenanceRecords();
        fetchStats();
      } else {
        const errorData = await response.json();
        alert(`Failed to postpone maintenance: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error postponing maintenance:', error);
      alert('Error postponing maintenance');
    }
  };

  const handleCompleteMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const payload = {
        maintenance_id: selectedRecord.maintenance_id,
        completion_date: completeData.completion_date,
        maintenance_cost: completeData.maintenance_cost ? parseFloat(completeData.maintenance_cost) : null
      };

      const response = await fetch(`${API_BASE}/maintenance/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        alert('Maintenance marked as completed!');
        setShowCompleteModal(false);
        setSelectedRecord(null);
        setCompleteData({
          completion_date: new Date().toISOString().split('T')[0],
          maintenance_cost: ''
        });
        fetchMaintenanceRecords();
        fetchStats();
      } else {
        const errorData = await response.json();
        alert(`Failed to complete maintenance: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error completing maintenance:', error);
      alert('Error completing maintenance');
    }
  };

  const handleDeleteMaintenance = async (maintenanceId: number) => {
    if (!confirm('Are you sure you want to delete this maintenance record? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${API_BASE}/maintenance/delete/${maintenanceId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('Maintenance record deleted successfully!');
        fetchMaintenanceRecords();
        fetchStats();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete maintenance: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      alert('Error deleting maintenance');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      'Overdue': 'bg-red-100 text-red-800',
      'Due Soon': 'bg-yellow-100 text-yellow-800',
      'Scheduled': 'bg-blue-100 text-blue-800',
      'Completed': 'bg-green-100 text-green-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount && amount !== 0) return '-';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Maintenance Scheduling</h2>
          <p className="text-gray-600 mt-1">Schedule and track asset maintenance</p>
        </div>
        <Button
          onClick={() => setShowScheduleModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Schedule Maintenance
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.overdue}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Due This Week</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.due_this_week}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pending</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.total_pending}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed (30d)</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.completed_this_month}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {formatCurrency(stats.total_cost_completed)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Records</option>
            <option value="pending">Pending Only</option>
            <option value="completed">Completed Only</option>
          </select>
        </div>
      </div>

      {/* Maintenance Records Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No maintenance records found
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.maintenance_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{record.asset_name || 'N/A'}</p>
                        <p className="text-sm text-gray-500">{record.asset_code || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{record.maintenance_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{record.vendor_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(record.maintenance_start)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.maintenance_end ? formatDate(record.maintenance_end) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(record.maintenance_cost)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {record.status !== 'Completed' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRecord(record);
                                setPostponeData({
                                  new_date: record.maintenance_start.split('T')[0],
                                  reason: ''
                                });
                                setShowPostponeModal(true);
                              }}
                              className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                              title="Postpone"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRecord(record);
                                setCompleteData({
                                  completion_date: new Date().toISOString().split('T')[0],
                                  maintenance_cost: record.maintenance_cost?.toString() || ''
                                });
                                setShowCompleteModal(true);
                              }}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Mark as Complete"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteMaintenance(record.maintenance_id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Maintenance Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Schedule Maintenance</h3>
            <form onSubmit={handleScheduleMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search Asset</label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={assetSearch}
                      onChange={(e) => {
                        setAssetSearch(e.target.value);
                        setShowAssetDropdown(true);
                      }}
                      onFocus={() => setShowAssetDropdown(true)}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search by asset code or name"
                    />
                  </div>
                  
                  {showAssetDropdown && filteredAssets.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredAssets.map((asset) => (
                        <div
                          key={asset.asset_id}
                          onClick={() => handleAssetSelect(asset)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <p className="font-medium text-gray-900">{asset.asset_code}</p>
                          <p className="text-sm text-gray-600">{asset.asset_name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showAssetDropdown && assetSearch && filteredAssets.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-4">
                      <p className="text-sm text-gray-500 text-center">No assets found</p>
                    </div>
                  )}
                </div>
                {formData.asset_id && (
                  <p className="text-xs text-green-600 mt-1">✓ Asset selected (ID: {formData.asset_id})</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vendor</label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Vendor (Optional)</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.vendor_id} value={vendor.vendor_id}>
                      {vendor.vendor_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Maintenance Type</label>
                <select
                  required
                  value={formData.maintenance_type}
                  onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="Preventive">Preventive</option>
                  <option value="Corrective">Corrective</option>
                  <option value="Calibration">Calibration</option>
                  <option value="Inspection">Inspection</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter maintenance description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Scheduled Date</label>
                <input
                  type="date"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Estimated Cost (Optional)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.maintenance_cost}
                    onChange={(e) => setFormData({ ...formData, maintenance_cost: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  Schedule
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setFormData({
                      asset_id: '',
                      vendor_id: '',
                      maintenance_type: '',
                      description: '',
                      scheduled_date: '',
                      maintenance_cost: '',
                      recorded_by: 1
                    });
                    setAssetSearch('');
                    setShowAssetDropdown(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {showCompleteModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Complete Maintenance</h3>
            <p className="text-sm text-gray-600 mb-4">
              Asset: {selectedRecord.asset_name || 'N/A'} ({selectedRecord.asset_code || 'N/A'})
            </p>
            <form onSubmit={handleCompleteMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Completion Date</label>
                <input
                  type="date"
                  required
                  value={completeData.completion_date}
                  onChange={(e) => setCompleteData({ ...completeData, completion_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Final Cost (Optional)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={completeData.maintenance_cost}
                    onChange={(e) => setCompleteData({ ...completeData, maintenance_cost: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={selectedRecord.maintenance_cost ? selectedRecord.maintenance_cost.toString() : "0.00"}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedRecord.maintenance_cost 
                    ? `Estimated cost: ${formatCurrency(selectedRecord.maintenance_cost)}`
                    : 'No estimated cost set'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  Complete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCompleteModal(false);
                    setSelectedRecord(null);
                    setCompleteData({
                      completion_date: new Date().toISOString().split('T')[0],
                      maintenance_cost: ''
                    });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Postpone Maintenance Modal */}
      {showPostponeModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Postpone Maintenance</h3>
            <p className="text-sm text-gray-600 mb-4">
              Asset: {selectedRecord.asset_name || 'N/A'} ({selectedRecord.asset_code || 'N/A'})
            </p>
            <form onSubmit={handlePostponeMaintenance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">New Date</label>
                <input
                  type="date"
                  required
                  value={postponeData.new_date}
                  onChange={(e) => setPostponeData({ ...postponeData, new_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason for Postponement</label>
                <textarea
                  value={postponeData.reason}
                  onChange={(e) => setPostponeData({ ...postponeData, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Optional - explain why maintenance is being postponed"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white">
                  Postpone
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowPostponeModal(false);
                    setSelectedRecord(null);
                    setPostponeData({ new_date: '', reason: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}