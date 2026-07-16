"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, MapPin, Gauge, Mountain, Clock, RefreshCw, Wifi, WifiOff } from "lucide-react";

interface TrajectoryPoint {
  time: number;
  r_ecef: number[];
  latitude: number;
  longitude: number;
  altitude: number;
}

interface ShipData {
  current: {
    gps_time: number;
    mission_time: number;
    altitude: number;
    speed: number;
    latitude: number;
    longitude: number;
    r_ecef: number[];
  };
  trajectory: TrajectoryPoint[];
}

interface TrackerData {
  ship39: ShipData;
}

const API_URL = "/api/starship";

export default function StarshipTracker() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [refreshRate, setRefreshRate] = useState(1000);
  const [mounted, setMounted] = useState(false);
  const [liveMissionTime, setLiveMissionTime] = useState<number>(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const missionTimeBaseRef = useRef<number>(0);
  const lastFetchTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const isFirstFetchRef = useRef<boolean>(true);

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData: any = await response.json();
      
      // Find the first ship key (excluding 'metadata')
      const shipKey = Object.keys(jsonData).find(
        key => key !== 'metadata' && jsonData[key]?.current
      );

      if (!shipKey) {
        throw new Error("No ship data found in response");
      }

      // Transform to match expected TrackerData structure
      const transformedData: TrackerData = {
        ship39: jsonData[shipKey]
      };

      setData(transformedData);
      setLastUpdate(new Date());
      setUpdateCount((prev) => prev + 1);
      setIsConnected(true);
      setError(null);

      // Sync mission time base with API data
      missionTimeBaseRef.current = transformedData.ship39.current.mission_time;
      lastFetchTimeRef.current = performance.now();

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setIsConnected(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();

    intervalRef.current = setInterval(fetchData, refreshRate);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshRate]);

  // High-frequency mission time update using requestAnimationFrame
  useEffect(() => {
    const updateMissionTime = () => {
      if (missionTimeBaseRef.current > 0) {
        const elapsed = (performance.now() - lastFetchTimeRef.current) / 1000;
        setLiveMissionTime(missionTimeBaseRef.current + elapsed);
      }
      animationFrameRef.current = requestAnimationFrame(updateMissionTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateMissionTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const ship = data?.ship39;

  const formatNumber = (num: number, decimals: number = 2) => {
    return num?.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) || "N/A";
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `T+${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20 border border-primary/30">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                SpaceX Starship Tracker
              </h1>
              <p className="text-muted-foreground text-sm">
                Real-time telemetry • Ship 39
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className="flex items-center gap-1.5 px-3 py-1.5"
            >
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
              <RefreshCw className="h-3.5 w-3.5 text-accent animate-spin" />
              <span className="text-sm text-muted-foreground">
                {updateCount} updates
              </span>
            </div>
            <select
              value={refreshRate}
              onChange={(e) => setRefreshRate(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-foreground cursor-pointer"
            >
              <option value={100}>100ms</option>
              <option value={500}>500ms</option>
              <option value={1000}>1s</option>
              <option value={5000}>5s</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
            <p className="text-sm font-medium">Connection Error: {error}</p>
            <p className="text-xs mt-1 opacity-80">Retrying automatically...</p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mountain className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Altitude</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {ship ? formatNumber(ship.current.altitude / 1000, 1) : "--"}
              </p>
              <p className="text-xs text-muted-foreground">km</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="h-4 w-4 text-accent" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Speed</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {ship ? formatNumber(ship.current.speed, 0) : "--"}
              </p>
              <p className="text-xs text-muted-foreground">m/s</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Position</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {ship ? formatNumber(ship.current.latitude, 4) : "--"}°
              </p>
              <p className="text-xs text-muted-foreground">
                {ship ? formatNumber(ship.current.longitude, 4) : "--"}° Lng
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-accent" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Mission Time</span>
              </div>
              <p className="text-2xl font-bold text-foreground font-mono tabular-nums">
                {liveMissionTime > 0 ? formatTime(liveMissionTime) : "--:--:--"}
              </p>
              <p className="text-xs text-muted-foreground">elapsed</p>
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <MapPin className="h-5 w-5 text-primary" />
              Live Position Map
              {lastUpdate && (
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-4">
            <div className="h-[500px] md:h-[600px] w-full relative">
              {mounted && ship && (
                <MapComponent
                  latitude={ship.current.latitude}
                  longitude={ship.current.longitude}
                  altitude={ship.current.altitude}
                  speed={ship.current.speed}
                  trajectory={ship.trajectory}
                />
              )}
              {!mounted && (
                <div className="h-full w-full flex items-center justify-center bg-secondary/20">
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Data source: SpaceX Public API • Updates every {refreshRate}ms</p>
          <p className="mt-1">This tracker fetches real-time telemetry data from SpaceX</p>
        </div>
      </div>
    </div>
  );
}

function MapComponent({
  latitude,
  longitude,
  altitude,
  speed,
  trajectory,
}: {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  trajectory: TrajectoryPoint[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num?.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) || "N/A";
  };

  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      // Fix default marker icon
      delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      // Create custom rocket icon
      const rocketIcon = L.divIcon({
        html: `<div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6, #06b6d4);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.6);
          border: 3px solid white;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12.5 2c-3.81 0-6.5 2.69-6.5 6.5 0 1.44.5 2.76 1.29 3.82L4 15l5.5-3h3L16 15l-3.21-2.68c.79-1.06 1.29-2.38 1.29-3.82 0-3.81-2.69-6.5-6.5-6.5zM12 22l-4-4h8l-4 4z"/>
          </svg>
        </div>`,
        className: "rocket-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      if (!leafletMapRef.current) {
        leafletMapRef.current = L.map(mapRef.current).setView([latitude, longitude], 3);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        }).addTo(leafletMapRef.current);

        markerRef.current = L.marker([latitude, longitude], {
          icon: rocketIcon,
        })
          .addTo(leafletMapRef.current)
          .bindPopup(`
            <div style="font-family: system-ui; padding: 8px;">
              <p style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">🚀 Ship 39</p>
              <p style="margin: 4px 0;">Altitude: ${formatNumber(altitude / 1000, 1)} km</p>
              <p style="margin: 4px 0;">Speed: ${formatNumber(speed, 0)} m/s</p>
              <p style="margin: 4px 0;">Lat: ${formatNumber(latitude, 4)}°</p>
              <p style="margin: 4px 0;">Lng: ${formatNumber(longitude, 4)}°</p>
            </div>
          `);

        // Add trajectory line
        if (trajectory.length > 1) {
          const trajectoryPath: [number, number][] = trajectory.map((point) => [
            point.latitude,
            point.longitude,
          ]);
          polylineRef.current = L.polyline(trajectoryPath, {
            color: "#60a5fa",
            weight: 2,
            opacity: 0.7,
            dashArray: "5, 10",
          }).addTo(leafletMapRef.current);
        }
      }
    };

    initMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (leafletMapRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      markerRef.current.setPopupContent(`
        <div style="font-family: system-ui; padding: 8px;">
          <p style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">🚀 Ship 39</p>
          <p style="margin: 4px 0;">Altitude: ${formatNumber(altitude / 1000, 1)} km</p>
          <p style="margin: 4px 0;">Speed: ${formatNumber(speed, 0)} m/s</p>
          <p style="margin: 4px 0;">Lat: ${formatNumber(latitude, 4)}°</p>
          <p style="margin: 4px 0;">Lng: ${formatNumber(longitude, 4)}°</p>
        </div>
      `);
      leafletMapRef.current.panTo([latitude, longitude], {
        animate: true,
        duration: 0.5,
      });

      // Update trajectory
      if (polylineRef.current && trajectory.length > 1) {
        const trajectoryPath: [number, number][] = trajectory.map((point) => [
          point.latitude,
          point.longitude,
        ]);
        polylineRef.current.setLatLngs(trajectoryPath);
      }
    }
  }, [latitude, longitude, altitude, speed, trajectory]);

  return <div ref={mapRef} className="h-full w-full" style={{ background: "#0a0a0f" }} />;
}
