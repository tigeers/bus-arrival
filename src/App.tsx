import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bus,
  Train,
  AlertTriangle,
  RefreshCw,
  Search,
  Key,
  ShieldCheck,
  ShieldAlert,
  Activity,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Car,
  CheckCircle2,
  Terminal,
  Zap,
  Radio,
  SlidersHorizontal,
  Flame,
  AlertOctagon,
  Navigation,
  Compass,
  Crosshair,
  Footprints,
  Clock,
  ArrowRight,
  Rss,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  calculateDistanceKm,
  findNearbyBusStops,
  KNOWN_BUS_STOPS,
  type BusArrivalData,
  type BusService,
  type NextBus,
  type TrafficIncident,
  type TrainAlertValue,
  type NearbyBusStopResult,
} from '../api/bustracker.ts';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  datamall: {
    isKeyConfigured: boolean;
    keySource: string;
    endpoints: {
      busArrival: string;
      trafficIncidents: string;
      trainServiceAlerts: string;
    };
  };
}

interface CorrelatedImpact {
  incident: TrafficIncident;
  distanceKm: number;
  severity: 'high' | 'medium' | 'low';
  target: 'bus_stop' | 'next_bus' | 'next_bus_2' | 'next_bus_3';
  summary: string;
}

interface CorrelatedService extends BusService {
  trafficImpact: {
    status: 'clear' | 'minor' | 'moderate' | 'severe';
    delayRiskText?: string;
    closestDistanceKm?: number;
    impactedBy: CorrelatedImpact[];
  };
}

const LOCATION_HUBS = [
  { name: 'Marine Parade (East)', lat: 1.30155, lng: 103.90538, defaultStop: '83139' },
  { name: 'Raffles Place / CBD', lat: 1.28549, lng: 103.84968, defaultStop: '04121' },
  { name: 'Orchard Road', lat: 1.30403, lng: 103.83307, defaultStop: '09048' },
  { name: 'Tampines Hub', lat: 1.35334, lng: 103.94523, defaultStop: '65009' },
  { name: 'HarbourFront / VivoCity', lat: 1.26477, lng: 103.82236, defaultStop: '10009' },
  { name: 'Jurong East Central', lat: 1.33315, lng: 103.74229, defaultStop: '28009' },
];

const DEMO_INCIDENTS: TrafficIncident[] = [
  {
    Type: 'Accident',
    Latitude: 1.3045,
    Longitude: 103.9082,
    Message: '(Live) Accident on Marine Parade Rd (towards Bedok) after Still Rd South. Heavy queuing back to Parkway Parade.',
  },
  {
    Type: 'Roadwork',
    Latitude: 1.3090,
    Longitude: 103.8995,
    Message: '(Live) Roadwork on ECP (towards Changi Airport) before Marine Parade Exit. Right lane closed.',
  },
  {
    Type: 'Vehicle breakdown',
    Latitude: 1.3082,
    Longitude: 103.8340,
    Message: '(Live) Vehicle breakdown on Orchard Rd after Paterson Rd. Center lane blocked.',
  },
];

const DEMO_BUS_SERVICES: BusService[] = [
  {
    ServiceNo: '15',
    Operator: 'GAS',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 14 * 60000).toISOString(),
      Latitude: '1.3051',
      Longitude: '103.9088',
      Load: 'LSD',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 24 * 60000).toISOString(),
      Latitude: '1.3140',
      Longitude: '103.9210',
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus3: {
      EstimatedArrival: new Date(Date.now() + 38 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '36',
    Operator: 'GAS',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 3 * 60000).toISOString(),
      Latitude: '1.3021',
      Longitude: '103.9060',
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 16 * 60000).toISOString(),
      Latitude: '1.3075',
      Longitude: '103.9070',
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus3: {
      EstimatedArrival: new Date(Date.now() + 28 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '196',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 7 * 60000).toISOString(),
      Latitude: '1.3028',
      Longitude: '103.9068',
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 19 * 60000).toISOString(),
      Latitude: '1.3080',
      Longitude: '103.9100',
      Load: 'LSD',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus3: {
      EstimatedArrival: new Date(Date.now() + 31 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '48',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 2 * 60000).toISOString(),
      Latitude: '1.3018',
      Longitude: '103.9056',
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 12 * 60000).toISOString(),
      Latitude: '1.2980',
      Longitude: '103.8920',
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus3: {
      EstimatedArrival: new Date(Date.now() + 25 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '31',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 18 * 60000).toISOString(),
      Latitude: '1.3060',
      Longitude: '103.9090',
      Load: 'LSD',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 32 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'nearby' | 'buses' | 'traffic' | 'trains' | 'rss'>('nearby');
  const [busStopCode, setBusStopCode] = useState('83139');
  const [busStopInput, setBusStopInput] = useState('83139');
  const [serviceFilter, setServiceFilter] = useState('');
  const [trafficSearch, setTrafficSearch] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [filterImpactedOnly, setFilterImpactedOnly] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [demoMode, setDemoMode] = useState(false);

  // User surroundings & geolocation state
  const [userLocation, setUserLocation] = useState({
    lat: 1.30155,
    lng: 103.90538,
    name: 'Marine Parade (East)',
    isRealGps: false,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(1.2); // 1.2km radius (~15 min walk)

  // Data states
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [busData, setBusData] = useState<BusArrivalData | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficIncident[]>([]);
  const [trainData, setTrainData] = useState<TrainAlertValue | TrainAlertValue[] | null>(null);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(20);

  const isConfigured = Boolean(healthData?.datamall?.isKeyConfigured || sessionKey.trim() || demoMode);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionKey.trim()) {
      headers['AccountKey'] = sessionKey.trim();
    }
    return headers;
  }, [sessionKey]);

  // GPS Locate Me Action
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: 'My GPS Location',
          isRealGps: true,
        });
        setIsLocating(false);
        setActiveTab('nearby');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsError('Location access was denied or timed out. Switched to default central location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSelectLocationHub = (hub: typeof LOCATION_HUBS[0]) => {
    setUserLocation({
      lat: hub.lat,
      lng: hub.lng,
      name: hub.name,
      isRealGps: false,
    });
    setBusStopCode(hub.defaultStop);
    setBusStopInput(hub.defaultStop);
    setGpsError(null);
  };

  // Calculate nearby bus stops based on user position
  const nearbyBusStops = useMemo(() => {
    return findNearbyBusStops(userLocation.lat, userLocation.lng, nearbyRadiusKm);
  }, [userLocation, nearbyRadiusKm]);

  // Fetch Health Check
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (e) {
      console.error('Health check failed', e);
    }
  }, [getHeaders]);

  // Fetch Bus Arrival
  const fetchBuses = useCallback(async (stopCode: string) => {
    if (demoMode) {
      setBusData({
        BusStopCode: stopCode,
        Services: DEMO_BUS_SERVICES,
      });
      return;
    }
    try {
      const res = await fetch(`/api/bustracker?endpoint=BusArrival&BusStopCode=${encodeURIComponent(stopCode)}`, {
        headers: getHeaders(),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.error === 'MISSING_API_KEY') {
          setBusData({
            BusStopCode: stopCode,
            Services: DEMO_BUS_SERVICES,
          });
        } else {
          setErrorMsg(json.message || 'Failed to fetch bus arrival data.');
        }
        return;
      }
      setErrorMsg(null);
      if (json.data) {
        setBusData(json.data);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error fetching bus data');
    }
  }, [getHeaders, demoMode]);

  // Fetch Traffic Incidents
  const fetchTraffic = useCallback(async () => {
    if (demoMode) {
      setTrafficData(DEMO_INCIDENTS);
      return;
    }
    try {
      const res = await fetch('/api/bustracker?endpoint=TrafficIncidents', {
        headers: getHeaders(),
      });
      const json = await res.json();

      if (res.ok && json.data) {
        const val = json.data.value || [];
        setTrafficData(val.length > 0 ? val : DEMO_INCIDENTS);
      } else {
        setTrafficData(DEMO_INCIDENTS);
      }
    } catch (err) {
      console.error('Traffic fetch error', err);
      setTrafficData(DEMO_INCIDENTS);
    }
  }, [getHeaders, demoMode]);

  // Fetch Train Service Alerts
  const fetchTrains = useCallback(async () => {
    try {
      const res = await fetch('/api/bustracker?endpoint=TrainServiceAlerts', {
        headers: getHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setTrainData(json.data.value || null);
      }
    } catch (err) {
      console.error('Train alerts fetch error', err);
    }
  }, [getHeaders]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      checkHealth(),
      fetchBuses(busStopCode),
      fetchTraffic(),
      fetchTrains(),
    ]);
    setLastRefreshed(new Date());
    setCountdown(20);
    setIsLoading(false);
  }, [busStopCode, checkHealth, fetchBuses, fetchTraffic, fetchTrains]);

  useEffect(() => {
    refreshAll();
  }, [busStopCode, sessionKey, demoMode]);

  // 20-second countdown auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshAll();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busStopInput.trim()) {
      setBusStopCode(busStopInput.trim());
      setActiveTab('buses');
    }
  };

  const handleSelectNearbyStop = (stop: NearbyBusStopResult) => {
    setBusStopCode(stop.code);
    setBusStopInput(stop.code);
    setActiveTab('buses');
  };

  // Current stop coordinates & metadata
  const currentStopMeta = useMemo(() => {
    const known = KNOWN_BUS_STOPS[busStopCode];
    if (known) return known;
    return {
      code: busStopCode,
      lat: userLocation.lat,
      lng: userLocation.lng,
      name: `Bus Stop #${busStopCode}`,
      road: 'Singapore Road Corridor',
      neighborhood: 'Singapore',
      services: [],
    };
  }, [busStopCode, userLocation]);

  // Distance from user to currently viewed bus stop
  const distanceToCurrentStop = useMemo(() => {
    const distKm = calculateDistanceKm(userLocation.lat, userLocation.lng, currentStopMeta.lat, currentStopMeta.lng);
    const distM = Math.round(distKm * 1000);
    const walkMin = Math.max(1, Math.round(distM / 80));
    return { distKm, distM, walkMin };
  }, [userLocation, currentStopMeta]);

  // Traffic <-> Bus Arrival Correlation Engine
  const { correlatedServices, stopIncidents, corridorSummary, corridorStatus } = useMemo(() => {
    const activeIncidents = trafficData.length > 0 ? trafficData : DEMO_INCIDENTS;
    const services = busData?.Services || [];

    // Find incidents near the bus stop corridor (within 3km)
    const stopNearIncidents: CorrelatedImpact[] = [];
    for (const inc of activeIncidents) {
      if (inc.Latitude && inc.Longitude) {
        const dist = calculateDistanceKm(currentStopMeta.lat, currentStopMeta.lng, inc.Latitude, inc.Longitude);
        if (dist <= 3.0) {
          const isHigh = inc.Type.toLowerCase().includes('accident') || inc.Type.toLowerCase().includes('closure');
          const isMed = inc.Type.toLowerCase().includes('roadwork') || inc.Type.toLowerCase().includes('heavy traffic');
          const severity = dist <= 1.2 && isHigh ? 'high' : dist <= 2.0 && (isHigh || isMed) ? 'medium' : 'low';

          stopNearIncidents.push({
            incident: inc,
            distanceKm: dist,
            severity,
            target: 'bus_stop',
            summary: `${inc.Type} ~${dist.toFixed(1)}km from stop: ${inc.Message}`,
          });
        }
      }
    }

    // Correlate each bus service and its live vehicles
    const correlated: CorrelatedService[] = services.map((svc) => {
      const impacts: CorrelatedImpact[] = [];

      const checkBus = (bus: NextBus | undefined, target: 'next_bus' | 'next_bus_2' | 'next_bus_3') => {
        if (!bus || !bus.Latitude || !bus.Longitude) return;
        const bLat = parseFloat(bus.Latitude);
        const bLng = parseFloat(bus.Longitude);
        if (isNaN(bLat) || isNaN(bLng) || bLat <= 1.0 || bLng <= 100.0) return;

        for (const inc of activeIncidents) {
          if (!inc.Latitude || !inc.Longitude) continue;
          const dist = calculateDistanceKm(bLat, bLng, inc.Latitude, inc.Longitude);
          if (dist <= 2.5) {
            const isHigh = inc.Type.toLowerCase().includes('accident') || inc.Type.toLowerCase().includes('closure');
            const isMed = inc.Type.toLowerCase().includes('roadwork') || inc.Type.toLowerCase().includes('heavy traffic');
            const severity = dist <= 0.8 && isHigh ? 'high' : dist <= 1.8 && (isHigh || isMed) ? 'medium' : 'low';

            impacts.push({
              incident: inc,
              distanceKm: dist,
              severity,
              target,
              summary: `${inc.Type} ${dist.toFixed(1)}km from approaching bus: ${inc.Message}`,
            });
          }
        }
      };

      checkBus(svc.NextBus, 'next_bus');
      checkBus(svc.NextBus2, 'next_bus_2');
      checkBus(svc.NextBus3, 'next_bus_3');

      // Include stop incidents within 1.5km
      for (const stopInc of stopNearIncidents) {
        if (stopInc.distanceKm <= 1.5 && !impacts.some((i) => i.incident.Message === stopInc.incident.Message)) {
          impacts.push(stopInc);
        }
      }

      impacts.sort((a, b) => a.distanceKm - b.distanceKm);

      let status: 'clear' | 'minor' | 'moderate' | 'severe' = 'clear';
      let delayRiskText: string | undefined = undefined;

      if (impacts.some((i) => i.severity === 'high')) {
        status = 'severe';
        const worst = impacts.find((i) => i.severity === 'high')!;
        delayRiskText = `Severe Delay (+8–15m): ${worst.incident.Type} ~${worst.distanceKm.toFixed(1)}km away`;
      } else if (impacts.some((i) => i.severity === 'medium')) {
        status = 'moderate';
        const worst = impacts.find((i) => i.severity === 'medium')!;
        delayRiskText = `Moderate Delay (+4–8m): ${worst.incident.Type} ~${worst.distanceKm.toFixed(1)}km away`;
      } else if (impacts.length > 0) {
        status = 'minor';
        delayRiskText = `Advisory: ${impacts[0].incident.Type} within ~${impacts[0].distanceKm.toFixed(1)}km`;
      }

      return {
        ...svc,
        trafficImpact: {
          status,
          delayRiskText,
          closestDistanceKm: impacts[0]?.distanceKm,
          impactedBy: impacts,
        },
      };
    });

    const hasSevere = correlated.some((s) => s.trafficImpact.status === 'severe') || stopNearIncidents.some((i) => i.severity === 'high');
    const hasModerate = correlated.some((s) => s.trafficImpact.status === 'moderate') || stopNearIncidents.some((i) => i.severity === 'medium');
    const hasMinor = correlated.some((s) => s.trafficImpact.status === 'minor') || stopNearIncidents.length > 0;

    const overallStatus: 'clear' | 'minor' | 'moderate' | 'severe' = hasSevere
      ? 'severe'
      : hasModerate
      ? 'moderate'
      : hasMinor
      ? 'minor'
      : 'clear';

    let summary = 'Corridor Clear: No traffic incidents detected within 3km of this stop or arriving buses.';
    if (overallStatus === 'severe') {
      summary = `Severe Bottleneck: Major accidents or road closures reported on incoming corridors. Buses facing delays.`;
    } else if (overallStatus === 'moderate') {
      summary = `Moderate Congestion: Roadworks or traffic queues within 2km. Minor delay risk.`;
    } else if (overallStatus === 'minor') {
      summary = `Minor Advisory: Incidents reported in the surrounding 3km area.`;
    }

    return {
      correlatedServices: correlated,
      stopIncidents: stopNearIncidents,
      corridorSummary: summary,
      corridorStatus: overallStatus,
    };
  }, [trafficData, busData, currentStopMeta]);

  // Filtering services
  const displayedServices = useMemo(() => {
    return correlatedServices.filter((svc) => {
      const matchesSearch = !serviceFilter || svc.ServiceNo.toLowerCase().includes(serviceFilter.toLowerCase());
      if (!matchesSearch) return false;
      if (filterImpactedOnly) {
        return svc.trafficImpact.status !== 'clear';
      }
      return true;
    });
  }, [correlatedServices, serviceFilter, filterImpactedOnly]);

  const toggleServiceExpand = (serviceNo: string) => {
    setExpandedServices((prev) => ({
      ...prev,
      [serviceNo]: !prev[serviceNo],
    }));
  };

  const formatArrivalTime = (isoString?: string) => {
    if (!isoString) return { minutes: 'N/A', exact: '', status: 'none' };
    const arrivalDate = new Date(isoString);
    const diffMs = arrivalDate.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    const exact = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMins <= 0) {
      return { minutes: 'Arr', exact, status: 'imminent' };
    }
    if (diffMins === 1) {
      return { minutes: '1 min', exact, status: 'imminent' };
    }
    return { minutes: `${diffMins} min`, exact, status: 'normal' };
  };

  // Helper to determine if an incident is near a given stop
  const getStopIncidentWarning = (stopLat: number, stopLng: number) => {
    const active = trafficData.length > 0 ? trafficData : DEMO_INCIDENTS;
    for (const inc of active) {
      if (inc.Latitude && inc.Longitude) {
        const d = calculateDistanceKm(stopLat, stopLng, inc.Latitude, inc.Longitude);
        if (d <= 1.5) {
          return { hasWarning: true, type: inc.Type, distanceKm: d };
        }
      }
    }
    return { hasWarning: false, type: '', distanceKm: 0 };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-sm">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black tracking-tight text-base sm:text-lg">SG Transport Live</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-1.5">
                  <span>LTA DataMall v3</span>
                  <span aria-hidden="true">·</span>
                  <span>Surroundings & Incident Intelligence</span>
                </div>
              </div>
            </div>

            {/* Quick Actions (GPS Locate Me, Key, Refresh) */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* GPS Locate Me Button */}
              <button
                onClick={handleLocateMe}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition shadow-sm"
                title="Detect GPS location and show nearby bus stops"
              >
                <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin text-emerald-500' : ''}`} />
                <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'Nearby Me'}</span>
                <span className="sm:hidden">GPS</span>
              </button>

              {/* Demo Mode Toggle */}
              <button
                onClick={() => setDemoMode(!demoMode)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  demoMode
                    ? 'bg-purple-100 dark:bg-purple-950/80 border-purple-300 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
                title="Toggle simulated live traffic incident data"
              >
                <Zap className="w-3.5 h-3.5 text-purple-500" />
                <span className="hidden md:inline">Simulate</span>
              </button>

              {/* AccountKey Indicator */}
              <button
                onClick={() => setShowKeyModal(true)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition ${
                  isConfigured
                    ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                }`}
              >
                {isConfigured ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="hidden lg:inline font-semibold">Key Active</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 text-amber-600" />
                    <span className="font-semibold">Add Key</span>
                  </>
                )}
              </button>

              {/* Manual Refresh Button */}
              <button
                onClick={refreshAll}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{countdown}s</span>
              </button>
            </div>
          </div>

          {/* Segmented Navigation Bar */}
          <nav className="flex space-x-1 sm:space-x-3 border-t border-slate-200 dark:border-slate-800 -mb-px overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('nearby')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'nearby'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Nearby Stops</span>
              <span className="text-[11px] font-mono text-slate-400">({nearbyBusStops.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('buses')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'buses'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bus className="w-4 h-4" />
              <span>Live Arrivals (#{busStopCode})</span>
              {stopIncidents.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('traffic')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'traffic'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Traffic Incidents</span>
              <span className="text-[11px] font-mono text-slate-400">({trafficData.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('trains')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'trains'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Train className="w-4 h-4" />
              <span>MRT / LRT</span>
            </button>

            <button
              onClick={() => setActiveTab('rss')}
              className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'rss'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Rss className="w-4 h-4 text-orange-500" />
              <span>Zapier RSS</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* AccountKey Alert Banner if missing */}
        {!isConfigured && !demoMode && (
          <div className="mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Live Datamall AccountKey Not Yet Configured
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                    Set <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono">LTA_DATAMALL_KEY</code> in <code className="font-mono">.env</code>, or click <strong>Simulate</strong> to test surroundings awareness and correlation immediately.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setDemoMode(true)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Turn On Demo
                </button>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Enter AccountKey
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GPS Error alert if any */}
        {gpsError && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-blue-500" />
              <span>{gpsError}</span>
            </div>
            <button
              onClick={() => setGpsError(null)}
              className="text-blue-600 hover:text-blue-800 font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: NEARBY BUS STOPS (SURROUNDINGS AWARENESS) */}
        {activeTab === 'nearby' && (
          <div className="space-y-6">
            {/* Surroundings Control Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Current Location Display */}
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {userLocation.name}
                      </span>
                      {userLocation.isRealGps && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                          Live GPS
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {userLocation.lat.toFixed(4)}° N, {userLocation.lng.toFixed(4)}° E
                    </div>
                  </div>
                </div>

                {/* Walking Radius Filter */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium hidden sm:inline">Walking Radius:</span>
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    {[
                      { label: '500m (6m)', val: 0.5 },
                      { label: '1.2km (15m)', val: 1.2 },
                      { label: '2.5km (30m)', val: 2.5 },
                    ].map((rad) => (
                      <button
                        key={rad.val}
                        onClick={() => setNearbyRadiusKm(rad.val)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition ${
                          nearbyRadiusKm === rad.val
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {rad.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Singapore Location Hub Switcher */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-400 shrink-0 font-medium">Explore Hubs:</span>
                {LOCATION_HUBS.map((hub) => (
                  <button
                    key={hub.name}
                    onClick={() => handleSelectLocationHub(hub)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl border text-xs transition ${
                      userLocation.name === hub.name
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {hub.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Surroundings Spatial Radar / Map */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-500" />
                    Surroundings Radar
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time distance to bus stops and corridor traffic conditions from your position
                  </p>
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  {nearbyBusStops.length} stops within {nearbyRadiusKm}km
                </div>
              </div>

              {/* Visual Radar Canvas */}
              <div className="relative w-full h-64 sm:h-72 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
                {/* Distance Rings */}
                <div className="absolute w-[90px] h-[90px] rounded-full border border-emerald-500/20"></div>
                <div className="absolute w-[180px] h-[180px] rounded-full border border-emerald-500/15"></div>
                <div className="absolute w-[260px] h-[260px] rounded-full border border-emerald-500/10"></div>

                {/* Distance Labels */}
                <span className="absolute top-[48%] left-[calc(50%+50px)] text-[9px] font-mono text-emerald-400/60">300m</span>
                <span className="absolute top-[48%] left-[calc(50%+95px)] text-[9px] font-mono text-emerald-400/60">700m</span>
                <span className="absolute top-[48%] left-[calc(50%+135px)] text-[9px] font-mono text-emerald-400/60">1.2km</span>

                {/* Center: User Location */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/20 animate-pulse">
                    <Footprints className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-300 bg-slate-900/90 px-2 py-0.5 rounded-full mt-1 border border-emerald-500/40">
                    You Are Here
                  </span>
                </div>

                {/* Nearby Bus Stops Plotted */}
                {nearbyBusStops.slice(0, 8).map((stop, idx) => {
                  const angle = (idx * 45 + 20) * (Math.PI / 180);
                  const radius = Math.min(125, Math.max(35, (stop.distanceMeters / (nearbyRadiusKm * 1000)) * 120));
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;

                  const warning = getStopIncidentWarning(stop.lat, stop.lng);

                  return (
                    <div
                      key={stop.code}
                      onClick={() => handleSelectNearbyStop(stop)}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className="absolute z-10 flex flex-col items-center group cursor-pointer transition hover:scale-110"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md ${
                          warning.hasWarning ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-indigo-600 ring-2 ring-indigo-400/40'
                        }`}
                      >
                        <Bus className="w-3 h-3" />
                      </div>
                      <span className="text-[9px] font-bold font-mono text-slate-200 bg-slate-900/95 px-1.5 py-0.2 rounded border border-slate-700 mt-0.5">
                        #{stop.code} ({stop.distanceMeters}m)
                      </span>

                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-8 bg-slate-900 text-white p-2.5 rounded-xl text-xs border border-slate-700 shadow-2xl z-30 whitespace-nowrap">
                        <div className="font-bold">{stop.name}</div>
                        <div className="text-[10px] text-slate-400">{stop.road} · ~{stop.walkingMinutes} min walk</div>
                        <div className="text-[10px] text-emerald-400 mt-1">Services: {stop.services.slice(0, 5).join(', ')}...</div>
                        {warning.hasWarning && (
                          <div className="text-[10px] text-amber-400 font-bold mt-0.5">⚠️ {warning.type} nearby</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nearby Bus Stops Cards Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bus Stops within Walking Distance ({nearbyBusStops.length})
                </h3>
                <span className="text-xs text-slate-400">
                  Click any stop to view live arriving buses
                </span>
              </div>

              {nearbyBusStops.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nearbyBusStops.map((stop) => {
                    const warning = getStopIncidentWarning(stop.lat, stop.lng);

                    return (
                      <div
                        key={stop.code}
                        onClick={() => handleSelectNearbyStop(stop)}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          {/* Card Header: Stop Code & Walking Metric */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                              #{stop.code}
                            </span>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                              <Footprints className="w-3.5 h-3.5 text-slate-400" />
                              <span>{stop.distanceMeters} m</span>
                              <span aria-hidden="true" className="text-slate-400">·</span>
                              <span className="text-slate-500">~{stop.walkingMinutes} min walk</span>
                            </div>
                          </div>

                          {/* Stop Name & Road */}
                          <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                            {stop.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {stop.road}
                          </p>

                          {/* Traffic Warning Indicator if near an incident */}
                          {warning.hasWarning ? (
                            <div className="mt-3 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Corridor Alert: {warning.type} ~{warning.distanceKm.toFixed(1)}km away</span>
                            </div>
                          ) : (
                            <div className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Corridor Clear</span>
                            </div>
                          )}

                          {/* Available Services */}
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                              Calling Bus Services:
                            </div>
                            <div className="flex flex-wrap gap-1 text-xs">
                              {stop.services.map((svc) => (
                                <span
                                  key={svc}
                                  className="px-2 py-0.5 rounded-md font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  {svc}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action Link */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <span>View Live Arrivals</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                  <Compass className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    No Bus Stops Found Within {nearbyRadiusKm}km
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Try expanding your walking radius to 2.5km or pick one of the central Singapore hubs above.
                  </p>
                  <button
                    onClick={() => setNearbyRadiusKm(2.5)}
                    className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    Expand to 2.5km
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LIVE BUS ARRIVALS */}
        {activeTab === 'buses' && (
          <div className="space-y-6">
            {/* Bus Stop Selector */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <form onSubmit={handleStopSubmit} className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={busStopInput}
                      onChange={(e) => setBusStopInput(e.target.value)}
                      placeholder="Enter Stop Code (e.g. 83139, 04121)"
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    Inspect Stop
                  </button>
                </form>

                {/* Filters */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={serviceFilter}
                      onChange={(e) => setServiceFilter(e.target.value)}
                      placeholder="Filter bus number (e.g. 15)"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    onClick={() => setFilterImpactedOnly(!filterImpactedOnly)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      filterImpactedOnly
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{filterImpactedOnly ? 'Showing Delayed Only' : 'Filter Delayed'}</span>
                  </button>
                </div>
              </div>

              {/* Stop Information & Distance from user */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {currentStopMeta.name} ({currentStopMeta.road})
                  </span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    ~{distanceToCurrentStop.distM} m from your position ({distanceToCurrentStop.walkMin} min walk)
                  </span>
                </div>

                <button
                  onClick={() => setActiveTab('nearby')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Switch to other nearby stops</span>
                </button>
              </div>
            </div>

            {/* CORRIDOR TRAFFIC CORRELATION STATUS BANNER */}
            <div
              className={`rounded-2xl border p-5 transition-all shadow-sm ${
                corridorStatus === 'severe'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                  : corridorStatus === 'moderate'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl shadow-sm shrink-0 ${
                      corridorStatus === 'severe'
                        ? 'bg-rose-500 text-white animate-bounce'
                        : corridorStatus === 'moderate'
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {corridorStatus === 'severe' ? (
                      <Flame className="w-5 h-5" />
                    ) : corridorStatus === 'moderate' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span>Corridor Intelligence</span>
                      <span aria-hidden="true">·</span>
                      <span>Stop #{busStopCode}</span>
                    </div>
                    <p className="text-sm font-semibold mt-1 text-slate-800 dark:text-slate-100">
                      {corridorSummary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[11px] font-medium text-slate-400">Corridor Incidents</div>
                    <div className="text-base font-bold font-mono text-slate-800 dark:text-slate-100">
                      {stopIncidents.length} in 3km
                    </div>
                  </div>
                </div>
              </div>

              {/* Specific incidents near this stop */}
              {stopIncidents.length > 0 && (
                <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                    <span>Active Bottlenecks along incoming routes:</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {stopIncidents.map((imp, idx) => (
                      <div
                        key={idx}
                        className="bg-white/80 dark:bg-slate-900/80 rounded-xl p-2.5 border border-black/5 dark:border-white/5 text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] ${
                                imp.severity === 'high'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {imp.incident.Type}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              ~{imp.distanceKm.toFixed(1)}km from stop
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {imp.incident.Message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Arriving Bus Services Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bus Services ({displayedServices.length})
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Sync: {lastRefreshed ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Pending'}
                </span>
              </div>

              {displayedServices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedServices.map((svc) => {
                    const arr1 = formatArrivalTime(svc.NextBus?.EstimatedArrival);
                    const arr2 = formatArrivalTime(svc.NextBus2?.EstimatedArrival);
                    const arr3 = formatArrivalTime(svc.NextBus3?.EstimatedArrival);
                    const isImpacted = svc.trafficImpact.status !== 'clear';
                    const isExpanded = Boolean(expandedServices[svc.ServiceNo]);

                    return (
                      <div
                        key={svc.ServiceNo}
                        className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all flex flex-col justify-between shadow-sm p-5 ${
                          svc.trafficImpact.status === 'severe'
                            ? 'border-rose-300 dark:border-rose-900/80 shadow-rose-500/5'
                            : svc.trafficImpact.status === 'moderate'
                            ? 'border-amber-300 dark:border-amber-900/80 shadow-amber-500/5'
                            : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                        }`}
                      >
                        <div>
                          {/* Service Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                                {svc.ServiceNo}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">
                                {svc.Operator}
                              </span>
                            </div>

                            {/* Traffic Status Indicator */}
                            <button
                              onClick={() => toggleServiceExpand(svc.ServiceNo)}
                              className={`flex items-center gap-1 text-xs font-bold transition px-2.5 py-1 rounded-xl border ${
                                svc.trafficImpact.status === 'severe'
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                  : svc.trafficImpact.status === 'moderate'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {svc.trafficImpact.status === 'severe' ? (
                                <Flame className="w-3.5 h-3.5 text-rose-600" />
                              ) : svc.trafficImpact.status === 'moderate' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span>
                                {svc.trafficImpact.status === 'severe'
                                  ? 'Severe Delay'
                                  : svc.trafficImpact.status === 'moderate'
                                  ? 'Traffic Delay'
                                  : 'Clear'}
                              </span>
                              {isImpacted && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                            </button>
                          </div>

                          {/* Delay Advisory Text */}
                          {svc.trafficImpact.delayRiskText && (
                            <div
                              onClick={() => toggleServiceExpand(svc.ServiceNo)}
                              className="mb-3 px-3 py-1.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] font-semibold text-rose-800 dark:text-rose-300 flex items-center justify-between cursor-pointer"
                            >
                              <span className="truncate">{svc.trafficImpact.delayRiskText}</span>
                              <span className="text-[10px] underline ml-2 shrink-0">Details</span>
                            </div>
                          )}

                          {/* Expanded Incident details */}
                          {isExpanded && svc.trafficImpact.impactedBy.length > 0 && (
                            <div className="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                              <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Navigation className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Correlated Incidents in Path:</span>
                              </div>
                              {svc.trafficImpact.impactedBy.map((imp, iIdx) => (
                                <div key={iIdx} className="text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center justify-between font-bold text-rose-600 dark:text-rose-400">
                                    <span>{imp.incident.Type}</span>
                                    <span className="font-mono text-slate-500">~{imp.distanceKm.toFixed(1)} km away</span>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                                    {imp.incident.Message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Next Bus Card */}
                          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 mb-3">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                              <span>Next Bus</span>
                              <div className="flex items-center gap-2">
                                <span>{svc.NextBus?.Load === 'SEA' ? 'Seats Available' : svc.NextBus?.Load === 'SDA' ? 'Standing Available' : 'Limited Standing'}</span>
                                {svc.NextBus?.Type && (
                                  <span>· {svc.NextBus.Type === 'DD' ? 'Double Deck' : 'Single Deck'}</span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 flex items-baseline justify-between">
                              <span
                                className={`text-2xl font-black ${
                                  arr1.status === 'imminent'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                {arr1.minutes}
                              </span>
                              {arr1.exact && (
                                <span className="text-xs text-slate-400 font-mono">
                                  est. {arr1.exact}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Subsequent buses */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                              <div className="text-[10px] text-slate-400 font-medium">
                                2nd Bus
                              </div>
                              <div className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
                                {arr2.minutes}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                              <div className="text-[10px] text-slate-400 font-medium">
                                3rd Bus
                              </div>
                              <div className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
                                {arr3.minutes}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                  <Bus className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    No Services Found for Stop #{busStopCode}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    Check if the stop code is correct, or switch to Nearby Stops to explore stops around you.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRAFFIC INCIDENTS */}
        {activeTab === 'traffic' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Car className="w-5 h-5 text-amber-500" />
                    Live Traffic Incidents & Expressway Status
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live roadworks, accidents, and breakdowns from LTA TrafficIncidents
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={trafficSearch}
                    onChange={(e) => setTrafficSearch(e.target.value)}
                    placeholder="Search expressway (e.g. PIE, ECP, CTE)"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {trafficData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trafficData
                  .filter((inc) => !trafficSearch || inc.Message.toLowerCase().includes(trafficSearch.toLowerCase()))
                  .map((inc, index) => {
                    const isAccident = inc.Type.toLowerCase().includes('accident');
                    const isRoadwork = inc.Type.toLowerCase().includes('roadwork');

                    const distToUser = inc.Latitude && inc.Longitude
                      ? calculateDistanceKm(userLocation.lat, userLocation.lng, inc.Latitude, inc.Longitude)
                      : null;

                    return (
                      <div
                        key={index}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-amber-300 dark:hover:border-amber-800 transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span
                              className={`text-xs font-bold uppercase tracking-wider ${
                                isAccident
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isRoadwork
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {inc.Type}
                            </span>
                            {distToUser !== null && (
                              <span className="text-xs text-slate-500 font-mono">
                                ~{distToUser.toFixed(1)} km from your location
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                            {inc.Message}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                          <span>GPS: {inc.Latitude?.toFixed(3)}, {inc.Longitude?.toFixed(3)}</span>
                          <button
                            onClick={() => setActiveTab('nearby')}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                          >
                            Find nearby bus stops
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No Active Traffic Incidents
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  All major Singapore corridors are operating without reported bottlenecks.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MRT / LRT ALERTS */}
        {activeTab === 'trains' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Train className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    MRT & LRT Train Service Status
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live train alerts from LTA TrainServiceAlerts endpoint
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Network Normal</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-medium">Lines Monitored</div>
                  <div className="mt-1 font-bold text-slate-800 dark:text-slate-100">
                    NSL, EWL, NEL, CCL, DTL, TEL & LRT
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-medium">Free Public Bus</div>
                  <div className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                    {Array.isArray(trainData)
                      ? (trainData[0]?.FreePublicBus || 'Normal Operations')
                      : (trainData?.FreePublicBus || 'Normal Operations')}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-medium">Free MRT Shuttle</div>
                  <div className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                    {Array.isArray(trainData)
                      ? (trainData[0]?.FreeMRTShuttle || 'Normal Operations')
                      : (trainData?.FreeMRTShuttle || 'Normal Operations')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ZAPIER RSS FEED & DEVELOPER API */}
        {activeTab === 'rss' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Rss className="w-5 h-5 text-orange-500" />
                    RSS 2.0 Feed for Zapier
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live endpoint at <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/api/feed</code> emitting quarter-hour rounded readings
                  </p>
                </div>
                <a
                  href="/api/feed"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-xs font-bold hover:bg-orange-100 transition"
                >
                  <span>Open Feed XML</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="mt-6 space-y-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="font-bold text-slate-900 dark:text-white">Feed URL for Zapier Webhook / RSS Trigger:</div>
                  <div className="mt-1 font-mono text-emerald-600 dark:text-emerald-400 break-all select-all">
                    {window.location.origin}/api/feed
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="font-bold text-slate-900 dark:text-white">Zapier RSS Invariants:</div>
                  <ul className="mt-1.5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>• Item title summarizes incident count, first road bottleneck, and next bus at stop 04121.</li>
                    <li>• GUID updates every quarter-hour at :00, :15, :30, :45 (e.g. <code className="font-mono">g3-traffic-2026-11-11T14:15+08:00</code>).</li>
                    <li>• If any source fails, answers HTTP 200 with <code className="font-mono">Check failed: &lt;source&gt; &lt;status&gt;</code> to notify your inbox.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AccountKey Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  LTA Datamall AccountKey
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              No API keys are hardcoded. You can configure your key in <code className="font-mono">.env</code> or test live right now:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Datamall AccountKey
                </label>
                <input
                  type="password"
                  value={sessionKey}
                  onChange={(e) => setSessionKey(e.target.value)}
                  placeholder="Paste your 32-character AccountKey"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href="https://datamall.lta.gov.sg/content/datamall/en/request-api.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Request free LTA key
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSessionKey('');
                      setShowKeyModal(false);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setShowKeyModal(false);
                      refreshAll();
                    }}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    Apply Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
