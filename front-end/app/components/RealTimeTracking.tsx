import { useEffect, useMemo, useState } from "react";
import { fetchAPI } from "../api/api";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  MapPin,
  Radio,
  Navigation,
  Clock,
  Building2,
  Layers
} from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Label } from "./ui/label";

/* ---------- Types ---------- */
type AssetLocation = {
  asset_id: number;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  current_room: string | null;
  room_id: number | null;
  floor_id: number | null;
  floor_name: string | null;
  building_id: number | null;
  building_name: string | null;
  last_seen_at: string;
  activity_status: "Active" | "Idle" | "Missing";
};

type Movement = {
  asset_id: number;
  asset_code: string;
  asset_name: string;
  room_name: string;
  scan_time: string;
};

type Building = {
  building_id: number;
  name: string;
};

type Floor = {
  floor_id: number;
  building_id: number;
  floor_level: number;
  name: string;
};

export function RealTimeTracking() {
  const [assets, setAssets] = useState<AssetLocation[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  /* ---------- Fetch data ---------- */
  useEffect(() => {
    fetchAPI<AssetLocation[]>("/tracking/current")
      .then(setAssets)
      .catch(console.error);

    fetchAPI<Movement[]>("/tracking/history")
      .then(setHistory)
      .catch(console.error);

    fetchAPI<Building[]>("/tracking/buildings")
      .then(setBuildings)
      .catch(console.error);

    fetchAPI<Floor[]>("/tracking/floors")
      .then(setFloors)
      .catch(console.error);
  }, []);

  /* ---------- Helpers ---------- */
  const formatTimeAgo = (timestamp: string) => {
    const minutes = Math.floor(
      (Date.now() - new Date(timestamp).getTime()) / 60000
    );
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-500";
      case "Idle":
        return "bg-green-500";
      case "Missing":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  /* ---------- Filter floors based on building ---------- */
  const availableFloors = useMemo(() => {
    if (!selectedBuilding) return [];
    return floors.filter(f => f.building_id === selectedBuilding);
  }, [floors, selectedBuilding]);

  /* ---------- Filter assets based on building/floor ---------- */
  const filteredAssets = useMemo(() => {
    let filtered = assets;
    
    if (selectedBuilding) {
      filtered = filtered.filter(a => a.building_id === selectedBuilding);
    }
    
    if (selectedFloor) {
      filtered = filtered.filter(a => a.floor_id === selectedFloor);
    }
    
    return filtered;
  }, [assets, selectedBuilding, selectedFloor]);

  /* ---------- Group assets by room ---------- */
  const assetsByLocation = useMemo(() => {
    return filteredAssets.reduce((acc, asset) => {
      const location = asset.current_room ?? "Unknown";
      if (!acc[location]) acc[location] = [];
      acc[location].push(asset);
      return acc;
    }, {} as Record<string, AssetLocation[]>);
  }, [filteredAssets]);

  /* ---------- Reset floor when building changes ---------- */
  useEffect(() => {
    setSelectedFloor(null);
  }, [selectedBuilding]);

  /* ---------- JSX ---------- */
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Real-Time Location Tracking (RTLS)
        </h2>
        <p className="text-muted-foreground">
          Track asset locations using RFID indoor positioning
        </p>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Asset List</TabsTrigger>
          <TabsTrigger value="zones">Zone-Based Tracking</TabsTrigger>
          <TabsTrigger value="history">Movement History</TabsTrigger>
        </TabsList>

        {/* LIST VIEW */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Assets – Current Location</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map(asset => (
                    <TableRow key={asset.asset_id}>
                      <TableCell>
                        <p className="font-medium">{asset.asset_code}</p>
                        <p className="text-xs text-muted-foreground">
                          {asset.asset_name}
                        </p>
                      </TableCell>
                      <TableCell>{asset.building_name ?? "—"}</TableCell>
                      <TableCell>{asset.floor_name ?? "—"}</TableCell>
                      <TableCell>
                        <MapPin className="inline h-4 w-4 mr-1" />
                        {asset.current_room ?? "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Clock className="inline h-4 w-4 mr-1" />
                        {formatTimeAgo(asset.last_seen_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${getActivityColor(
                              asset.activity_status
                            )}`}
                          />
                          {asset.activity_status}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ZONE VIEW */}
        <TabsContent value="zones">
          <Card className="mb-4">
            <CardHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Building</Label>
                  <select
                    className="w-full p-2 border rounded mt-1"
                    value={selectedBuilding ?? ""}
                    onChange={(e) => setSelectedBuilding(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">All Buildings</option>
                    {buildings.map(b => (
                      <option key={b.building_id} value={b.building_id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label>Floor</Label>
                  <select
                    className="w-full p-2 border rounded mt-1"
                    value={selectedFloor ?? ""}
                    onChange={(e) => setSelectedFloor(e.target.value ? Number(e.target.value) : null)}
                    disabled={!selectedBuilding}
                  >
                    <option value="">All Floors</option>
                    {availableFloors.map(f => (
                      <option key={f.floor_id} value={f.floor_id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
          </Card>

          {filteredAssets.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  No assets found in the selected location
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(assetsByLocation).map(([room, roomAssets]) => (
                <Card key={room}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-blue-600" />
                      {room}
                    </CardTitle>
                    <CardDescription>
                      {roomAssets.length} asset{roomAssets.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      {roomAssets.map(asset => (
                        <div
                          key={asset.asset_id}
                          className="flex justify-between p-2 bg-gray-50 rounded mb-1"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{asset.asset_code}</p>
                            <p className="text-xs text-muted-foreground truncate">{asset.asset_name}</p>
                          </div>
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ml-2 ${getActivityColor(
                              asset.activity_status
                            )}`}
                          />
                        </div>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Asset Movement History (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((m, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <p className="font-medium">{m.asset_code}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.asset_name}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Navigation className="inline h-4 w-4 mr-1" />
                        {m.room_name}
                      </TableCell>
                      <TableCell>
                        {new Date(m.scan_time).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimeAgo(m.scan_time)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}