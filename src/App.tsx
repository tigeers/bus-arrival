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
  Eye,
  SlidersHorizontal,
  Flame,
  AlertOctagon,
  CornerDownRight,
  Navigation,
} from 'lucide-react';
import {
  calculateDistanceKm,
  KNOWN_BUS_STOPS,
  type BusArrivalData,
  type BusService,
  type NextBus,
  type TrafficIncident,
  type TrainAlertValue,
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

const PRESET_STOPS = [
  { code: '83139', name: 'Opp Parkway Parade', road: 'Marine Parade Rd' },
  { code: '09048', name: 'Orchard Stn / Lucky Plaza', road: 'Orchard Rd' },
  { code: '65009', name: 'Tampines Stn / Int', road: 'Tampines Ave 4' },
  { code: '10009', name: 'Opp VivoCity', road: 'Telok Blangah Rd' },
  { code: '04121', name: 'OCBC Ctr / Raffles Pl', road: 'Chulia St' },
  { code: '28009', name: 'Jurong East Bus Int', road: 'Jurong Gateway Rd' },
];

// Sample simulated live data for when key is missing or testing correlation
const DEMO_INCIDENTS: TrafficIncident[] = [
  {
    Type: 'Accident',
    Latitude: 1.3045,
    Longitude: 103.9082,
    Message: '(Live) Accident on Marine Parade Rd (towards Bedok) after Still Rd South. Congestion back to Parkway Parade. Expect heavy delays.',
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
  const [activeTab, setActiveTab] = useState<'buses' | 'radar' | 'traffic' | 'trains' | 'inspector'>('buses');
  const [busStopCode, setBusStopCode] = useState('83139');
  const [busStopInput, setBusStopInput] = useState('83139');
  const [serviceFilter, setServiceFilter] = useState('');
  const [trafficSearch, setTrafficSearch] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [filterImpactedOnly, setFilterImpactedOnly] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [demoMode, setDemoMode] = useState(false);

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

  // Inspector raw responses
  const [rawResponses, setRawResponses] = useState<Record<string, unknown>>({});

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

  // Fetch Health Check
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
        setRawResponses((prev) => ({ ...prev, health: data }));
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
      setRawResponses((prev) => ({ ...prev, busArrival: json }));

      if (!res.ok) {
        if (json.error === 'MISSING_API_KEY') {
          // If no key is set yet, enable demo mode gently or show prompt
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
      setRawResponses((prev) => ({ ...prev, trafficIncidents: json }));

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
      setRawResponses((prev) => ({ ...prev, trainAlerts: json }));

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
    }
  };

  // Current stop coordinates & metadata
  const currentStopMeta = useMemo(() => {
    const known = KNOWN_BUS_STOPS[busStopCode];
    if (known) return known;
    return {
      lat: 1.30155,
      lng: 103.90538,
      name: `Bus Stop #${busStopCode}`,
      road: 'Singapore Corridor',
    };
  }, [busStopCode]);

  // Core Traffic <-> Bus Arrival Correlation Engine
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
      summary = `Severe Congestion Alert: Major incidents (accident/closure) reported within the route corridor. Approaching buses may face 10–15+ min delays.`;
    } else if (overallStatus === 'moderate') {
      summary = `Moderate Traffic Advisory: Roadwork or heavy congestion detected within 2km corridor. Expect 4–8 min arrival variance.`;
    } else if (overallStatus === 'minor') {
      summary = `Minor Advisory: Incident reported in the wider 3km area. Buses moving with minor queuing.`;
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

  const getLoadBadge = (load?: string) => {
    switch (load) {
      case 'SEA':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">Seats</span>;
      case 'SDA':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">Standing</span>;
      case 'LSD':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">Packed</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'DD':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">Double Deck</span>;
      case 'BD':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">Bendy</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Single</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  SG Transport Live
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                    Correlated v3
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  LTA DataMall Bus Arrivals × Traffic Incidents Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Demo Mode Toggle */}
              <button
                onClick={() => setDemoMode(!demoMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  demoMode
                    ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
                title="Toggle simulated traffic incident correlation"
              >
                <Zap className="w-3.5 h-3.5 text-purple-500" />
                <span className="hidden sm:inline">Simulate Incidents</span>
                <span className="sm:hidden">Sim</span>
              </button>

              {/* AccountKey Indicator */}
              <button
                onClick={() => setShowKeyModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isConfigured
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}
              >
                {isConfigured ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">AccountKey Ready</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Set Key</span>
                  </>
                )}
              </button>

              {/* Refresh Controls */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-1 font-medium ${
                    autoRefresh ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>20s sync</span>
                </button>
                {autoRefresh && (
                  <span className="w-5 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                    {countdown}s
                  </span>
                )}
              </div>

              <button
                onClick={refreshAll}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 sm:space-x-4 border-t border-slate-200 dark:border-slate-800 -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('buses')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'buses'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bus className="w-4 h-4" />
              <span>Correlated Bus Arrivals</span>
              {stopIncidents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                  {stopIncidents.length} alert{stopIncidents.length > 1 ? 's' : ''}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('radar')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'radar'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Radio className="w-4 h-4 text-indigo-500" />
              <span>Corridor Proximity Radar</span>
            </button>

            <button
              onClick={() => setActiveTab('traffic')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'traffic'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Traffic Incidents</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {trafficData.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('trains')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'trains'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Train className="w-4 h-4" />
              <span>Train Alerts</span>
            </button>

            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'inspector'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>API Inspector</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner if API key not configured yet */}
        {!isConfigured && !demoMode && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    LTA Datamall Live AccountKey Required
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 max-w-2xl leading-relaxed">
                    No keys are hardcoded in the codebase. Set <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono">LTA_DATAMALL_KEY</code> in <code className="font-mono">.env</code>, or click <strong>Simulate Incidents</strong> to test the correlation intelligence immediately.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDemoMode(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Turn On Demo
                </button>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  Enter AccountKey
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: CORRELATED BUS ARRIVALS */}
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
                      placeholder="Enter 5-digit Stop Code (e.g. 83139)"
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    Look Up Stop
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

                  {/* Filter Affected Only Button */}
                  <button
                    onClick={() => setFilterImpactedOnly(!filterImpactedOnly)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      filterImpactedOnly
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{filterImpactedOnly ? 'Showing Impacted Only' : 'Filter Delayed'}</span>
                  </button>
                </div>
              </div>

              {/* Preset Bus Stop Chips */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-400 shrink-0 font-medium">Quick Stops:</span>
                {PRESET_STOPS.map((preset) => (
                  <button
                    key={preset.code}
                    onClick={() => {
                      setBusStopInput(preset.code);
                      setBusStopCode(preset.code);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      busStopCode === preset.code
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-mono">{preset.code}</span> — {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* CORRIDOR TRAFFIC CORRELATION STATUS BANNER */}
            <div
              className={`rounded-2xl border p-5 transition-all shadow-sm ${
                corridorStatus === 'severe'
                  ? 'bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 dark:from-rose-950/40 dark:via-red-950/30 dark:to-orange-950/30 border-rose-300 dark:border-rose-800'
                  : corridorStatus === 'moderate'
                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-300 dark:border-amber-800'
                  : 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800'
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/40 text-slate-800 dark:text-slate-200">
                        Corridor Intelligence
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {currentStopMeta.name} ({currentStopMeta.road})
                      </span>
                    </div>
                    <p className="text-sm font-semibold mt-1 text-slate-800 dark:text-slate-100">
                      {corridorSummary}
                    </p>
                  </div>
                </div>

                {/* Quick stats & Jump to Radar */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Nearby Incidents</div>
                    <div className="text-lg font-black font-mono text-slate-800 dark:text-slate-100">
                      {stopIncidents.length} in 3km
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('radar')}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:border-emerald-400 transition"
                  >
                    <Radio className="w-4 h-4 text-emerald-500" />
                    <span>View Radar</span>
                  </button>
                </div>
              </div>

              {/* List of specific incidents near this stop corridor */}
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

            {/* Bus Services Header & Active Stop */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Arriving Bus Services ({displayedServices.length})
                </h2>
              </div>
              <div className="text-xs text-slate-400">
                {lastRefreshed && (
                  <span>Sync: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                )}
              </div>
            </div>

            {/* SERVICES CARDS */}
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
                      className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all flex flex-col justify-between shadow-sm ${
                        svc.trafficImpact.status === 'severe'
                          ? 'border-rose-300 dark:border-rose-900/80 shadow-rose-500/5'
                          : svc.trafficImpact.status === 'moderate'
                          ? 'border-amber-300 dark:border-amber-900/80 shadow-amber-500/5'
                          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                      }`}
                    >
                      <div className="p-5">
                        {/* Service Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                              {svc.ServiceNo}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {svc.Operator || 'BUS'}
                            </span>
                          </div>

                          {/* Traffic Correlation Status Pill */}
                          <button
                            onClick={() => toggleServiceExpand(svc.ServiceNo)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                              svc.trafficImpact.status === 'severe'
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                : svc.trafficImpact.status === 'moderate'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
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
                                : 'Route Clear'}
                            </span>
                            {isImpacted && (
                              isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />
                            )}
                          </button>
                        </div>

                        {/* Traffic Impact Delay Risk Note */}
                        {svc.trafficImpact.delayRiskText && (
                          <div
                            onClick={() => toggleServiceExpand(svc.ServiceNo)}
                            className="mb-3 px-3 py-1.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] font-semibold text-rose-800 dark:text-rose-300 flex items-center justify-between cursor-pointer hover:bg-rose-100/70"
                          >
                            <span className="truncate">{svc.trafficImpact.delayRiskText}</span>
                            <span className="text-[10px] underline ml-2 shrink-0">Details</span>
                          </div>
                        )}

                        {/* Detailed Correlated Incident Drawer */}
                        {isExpanded && svc.trafficImpact.impactedBy.length > 0 && (
                          <div className="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs animate-in fade-in">
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
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Next Bus
                            </span>
                            <div className="flex items-center gap-1.5">
                              {getLoadBadge(svc.NextBus?.Load)}
                              {getTypeBadge(svc.NextBus?.Type)}
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
                          {svc.NextBus?.Latitude && svc.NextBus?.Longitude && (
                            <div className="mt-1 text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>GPS: {parseFloat(svc.NextBus.Latitude).toFixed(3)}, {parseFloat(svc.NextBus.Longitude).toFixed(3)}</span>
                            </div>
                          )}
                        </div>

                        {/* Subsequent buses */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              Second Bus
                            </div>
                            <div className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
                              {arr2.minutes}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {getLoadBadge(svc.NextBus2?.Load)}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              Third Bus
                            </div>
                            <div className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
                              {arr3.minutes}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {getLoadBadge(svc.NextBus3?.Load)}
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
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                  {filterImpactedOnly ? 'No Delayed Bus Services' : 'No Bus Services Found'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {filterImpactedOnly
                    ? 'Good news! None of the services at this stop currently have correlated traffic bottlenecks.'
                    : 'Check your stop code or test with another stop preset.'}
                </p>
                {filterImpactedOnly && (
                  <button
                    onClick={() => setFilterImpactedOnly(false)}
                    className="mt-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    View All Services
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CORRIDOR PROXIMITY RADAR */}
        {activeTab === 'radar' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-indigo-500" />
                    Live Corridor Radar Visualizer
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Spatial proximity between Bus Stop <span className="font-mono font-bold text-emerald-600">#{busStopCode}</span>, approaching bus vehicles, and reported traffic incidents
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span>Bus Stop</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                    <span>Approaching Buses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                    <span>Traffic Incidents</span>
                  </div>
                </div>
              </div>

              {/* Radar Graphical Canvas Simulation */}
              <div className="mt-6 relative w-full h-[420px] bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
                {/* Concentric distance rings */}
                <div className="absolute w-[120px] h-[120px] rounded-full border border-indigo-500/20"></div>
                <div className="absolute w-[240px] h-[240px] rounded-full border border-indigo-500/15"></div>
                <div className="absolute w-[360px] h-[360px] rounded-full border border-indigo-500/10"></div>

                {/* Radar axis crosshairs */}
                <div className="absolute w-full h-[1px] bg-indigo-500/10"></div>
                <div className="absolute h-full w-[1px] bg-indigo-500/10"></div>

                {/* Ring distance labels */}
                <span className="absolute top-[48%] left-[calc(50%+65px)] text-[9px] font-mono text-indigo-400/60">500m</span>
                <span className="absolute top-[48%] left-[calc(50%+125px)] text-[9px] font-mono text-indigo-400/60">1.5km</span>
                <span className="absolute top-[48%] left-[calc(50%+185px)] text-[9px] font-mono text-indigo-400/60">3.0km</span>

                {/* Center: Selected Bus Stop */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/50 ring-4 ring-emerald-500/20 animate-pulse">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold font-mono text-emerald-400 bg-slate-900/90 px-2 py-0.5 rounded-full mt-1 border border-emerald-500/40">
                    Stop #{busStopCode}
                  </span>
                </div>

                {/* Plotted Approaching Buses */}
                {correlatedServices.slice(0, 6).map((svc, idx) => {
                  // Distribute buses on radar
                  const angle = (idx * 60 + 25) * (Math.PI / 180);
                  const radius = 55 + (idx % 3) * 50;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;

                  return (
                    <div
                      key={svc.ServiceNo}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className="absolute z-10 flex flex-col items-center group cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md ring-2 ring-indigo-400/40">
                        <Bus className="w-3 h-3" />
                      </div>
                      <span className="text-[10px] font-black font-mono text-indigo-200 bg-slate-900/90 px-1.5 py-0.2 rounded border border-indigo-500/40 mt-0.5">
                        Bus {svc.ServiceNo}
                      </span>

                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-8 bg-slate-900 text-white p-2 rounded-lg text-[10px] border border-slate-700 whitespace-nowrap shadow-xl z-20">
                        <div className="font-bold">Service {svc.ServiceNo} ({svc.Operator})</div>
                        <div>Est: {svc.NextBus?.EstimatedArrival ? formatArrivalTime(svc.NextBus.EstimatedArrival).minutes : 'N/A'}</div>
                        <div className={svc.trafficImpact.status !== 'clear' ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {svc.trafficImpact.status !== 'clear' ? svc.trafficImpact.delayRiskText : 'Corridor Clear'}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Plotted Traffic Incidents */}
                {stopIncidents.map((imp, idx) => {
                  const angle = (idx * 90 + 140) * (Math.PI / 180);
                  const radius = Math.min(170, Math.max(50, imp.distanceKm * 60));
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;

                  return (
                    <div
                      key={idx}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className="absolute z-10 flex flex-col items-center group cursor-pointer animate-pulse"
                    >
                      <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/50 ring-4 ring-rose-500/30">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold text-rose-300 bg-slate-900/90 px-1.5 py-0.2 rounded border border-rose-500/40 mt-0.5">
                        {imp.incident.Type} ({imp.distanceKm.toFixed(1)}km)
                      </span>

                      {/* Tooltip */}
                      <div className="hidden group-hover:block absolute bottom-9 bg-slate-900 text-white p-2.5 rounded-xl text-xs border border-rose-500/50 max-w-xs shadow-2xl z-20">
                        <div className="font-bold text-rose-400">{imp.incident.Type} Incident</div>
                        <div className="text-[11px] text-slate-300 mt-1">{imp.incident.Message}</div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">Distance: ~{imp.distanceKm.toFixed(2)} km from stop</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explanatory legend below */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-slate-600 dark:text-slate-400">
                  <strong>How correlation works:</strong> The algorithm measures distance between the GPS coordinate of each approaching bus and active incidents from <code className="font-mono">/TrafficIncidents</code>. Any incident within 2.5km triggers an automated delay projection on that specific service.
                </div>
                <button
                  onClick={() => setActiveTab('buses')}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                >
                  Return to Bus List
                </button>
              </div>
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
                    Live Traffic Incidents & Affected Bus Stops
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cross-referenced with Singapore Land Transport Authority corridors
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={trafficSearch}
                    onChange={(e) => setTrafficSearch(e.target.value)}
                    placeholder="Search expressway or road (e.g. PIE, ECP)"
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

                    // Calculate distance to current stop
                    const distToCurrent = inc.Latitude && inc.Longitude
                      ? calculateDistanceKm(currentStopMeta.lat, currentStopMeta.lng, inc.Latitude, inc.Longitude)
                      : null;

                    return (
                      <div
                        key={index}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-amber-300 dark:hover:border-amber-800 transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                isAccident
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-400'
                                  : isRoadwork
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-400'
                              }`}
                            >
                              {inc.Type}
                            </span>
                            {distToCurrent !== null && (
                              <span
                                className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                                  distToCurrent <= 2.0
                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                ~{distToCurrent.toFixed(1)} km from stop #{busStopCode}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                            {inc.Message}
                          </p>
                        </div>

                        {/* Correlated Stop Action */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            GPS: {inc.Latitude?.toFixed(3)}, {inc.Longitude?.toFixed(3)}
                          </span>
                          <button
                            onClick={() => {
                              setActiveTab('buses');
                            }}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-1"
                          >
                            <span>Check Stop #{busStopCode} Impact</span>
                            <CornerDownRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  No Active Traffic Incidents Reported
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  All major Singapore expressways and arterial corridors are currently clear.
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
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Train className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    MRT & LRT Train Service Status
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Live train service alerts from LTA TrainServiceAlerts endpoint
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
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
                      ? (trainData[0]?.FreePublicBus || 'Not Activated (Normal)')
                      : (trainData?.FreePublicBus || 'Not Activated (Normal)')}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-medium">Free MRT Shuttle</div>
                  <div className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                    {Array.isArray(trainData)
                      ? (trainData[0]?.FreeMRTShuttle || 'Not Activated (Normal)')
                      : (trainData?.FreeMRTShuttle || 'Not Activated (Normal)')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: API INSPECTOR */}
        {activeTab === 'inspector' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-500" />
                Datamall Serverless Connection Inspector
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Endpoints configured in <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/api/bustracker.ts</code> and <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/api/health.ts</code>
              </p>

              <div className="mt-6 space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold text-indigo-600">GET /api/bustracker/correlate?BusStopCode=83139</span>
                  <p className="text-slate-500 mt-0.5">Fetches BusArrival v3 + TrafficIncidents and outputs correlated delay predictions and geographic distances.</p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold text-blue-600">GET /api/bustracker?endpoint=BusArrival&BusStopCode=83139</span>
                  <p className="text-slate-500 mt-0.5">Direct LTA Datamall v3 BusArrival endpoint.</p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold text-amber-600">GET /api/bustracker?endpoint=TrafficIncidents</span>
                  <p className="text-slate-500 mt-0.5">Direct LTA TrafficIncidents endpoint.</p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold text-emerald-600">GET /api/bustracker?endpoint=TrainServiceAlerts</span>
                  <p className="text-slate-500 mt-0.5">Direct LTA TrainServiceAlerts endpoint.</p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Sample Live Correlated Response Payload
                </h3>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-64 border border-slate-800">
                  {JSON.stringify(
                    {
                      busStopCode,
                      corridorStatus,
                      corridorSummary,
                      nearbyIncidentsCount: stopIncidents.length,
                      stopIncidents,
                      sampleServices: correlatedServices.slice(0, 2),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AccountKey Session Modal */}
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
              No API keys are hardcoded in the repository. You can either configure your key in <code className="font-mono">.env</code> or test live by entering it below:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Datamall AccountKey Header
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
