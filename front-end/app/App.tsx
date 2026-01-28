import { useState } from "react";
import { useAuth } from "./contexts/AuthContext";
import { Login } from "./components/login";
import { Dashboard } from "./components/Dashboard";
import  {AssetManagement}  from "./components/AssetManagement";
import { RealTimeTracking } from "./components/RealTimeTracking";
import { UtilizationAnalytics } from "./components/UtilizationAnalytics";
import { AlertsNotifications } from "./components/AlertsNotifications";
import { UserRoleManagement } from "./components/UserRoleManagement";
import MaintenanceScheduling from './components/MaintenanceScheduling';

import { Button } from "./components/ui/button";
import { 
  LayoutDashboard, 
  Package, 
  MapPin, 
  TrendingUp, 
  Bell, 
  Users, 
  Menu,
  X,
  Hospital,
  LogOut,
  Wrench,
  MessageSquare // NEW: Import chatbot icon
} from "lucide-react";

type Module = 
  | "dashboard" 
  | "assets" 
  | "tracking" 
  | "analytics" 
  | "alerts" 
  | "users"
  | "maintenance";
 

export default function App() {
  const { user, login, logout, isLoading } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Hospital className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  const menuItems = [
    { id: "dashboard" as Module, label: "Dashboard", icon: LayoutDashboard },
    { id: "assets" as Module, label: "Asset Management", icon: Package },
    { id: "tracking" as Module, label: "Real-Time Tracking", icon: MapPin },
    { id: "analytics" as Module, label: "Utilization Analytics", icon: TrendingUp },
    { id: "maintenance" as Module, label: "Maintenance Scheduling", icon: Wrench },
    { id: "alerts" as Module, label: "Alerts & Notifications", icon: Bell },
    { id: "users" as Module, label: "User & Role Management", icon: Users },
  ];

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard": return <Dashboard />;
      case "assets": return <AssetManagement />;
      case "tracking": return <RealTimeTracking />;
      case "analytics": return <UtilizationAnalytics />;
      case "maintenance": return <MaintenanceScheduling />;
      case "alerts": return <AlertsNotifications />;
      case "users": return <UserRoleManagement />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Hospital className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Asset Tracking System</h1>
                <p className="text-xs text-gray-600">City General Hospital</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            <div className="flex items-center gap-3 pl-3 border-l">
              <div className="text-right">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-gray-600">{user.role || 'User'}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="ml-2"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:sticky lg:translate-x-0 top-[73px] left-0 z-40 h-[calc(100vh-73px)] w-64 bg-white border-r border-gray-200 transition-transform duration-300 overflow-y-auto`}
        >
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start gap-3 ${
                    isActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setActiveModule(item.id);
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm">{item.label}</span>
                </Button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 mt-[73px] lg:mt-0">
          <div className="max-w-[1600px] mx-auto">
            {renderModule()}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}