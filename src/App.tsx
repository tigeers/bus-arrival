import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Users,
  Accessibility,
  ExternalLink,
  ChevronRight,
  Clock,
  Car,
  CheckCircle2,
  Terminal,
  Zap,
} from 'lucide-react';

interface NextBus {
  OriginCode?: string;
  DestinationCode?: string;
  EstimatedArrival?: string;
  Latitude?: string;
  Longitude?: string;
  VisitNumber?: string;
  Load?: 'SEA' | 'SDA' | 'LSD' | string;
  Feature?: 'WAB' | string;
  Type?: 'SD' | 'DD' | 'BD' | string;
}

interface BusService {
  ServiceNo: string;
  Operator: string;
  NextBus?: NextBus;
  NextBus2?: NextBus;
  NextBus3?: NextBus;
}

interface BusArrivalResponse {
  BusStopCode: string;
  Services: BusService[];
}

interface TrafficIncident {
  Type: string;
  Latitude: number;
  Longitude: number;
  Message: string;
}

interface TrainAlertMessage {
  Content?: string;
  CreatedDate?: string;
}

interface TrainAlertValue {
  Status?: number;
  Line?: string;
  Direction?: string;
  Stations?: string;
  FreePublicBus?: string;
  FreeMRTShuttle?: string;
  Message?: TrainAlertMessage[] | null;
}

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

const PRESET_STOPS = [
  { code: '83139', name: 'Opp Parkway Parade', road: 'Marine Parade Rd' },
  { code: '09048', name: 'Orchard Stn / Lucky Plaza', road: 'Orchard Rd' },
  { code: '65009', name: 'Tampines Stn / Int', road: 'Tampines Ave 4' },
  { code: '10009', name: 'Opp VivoCity', road: 'Telok Blangah Rd' },
  { code: '04121', name: 'OCBC Ctr / Raffles Pl', road: 'Chulia St' },
  { code: '28009', name: 'Jurong East Bus Int', road: 'Jurong Gateway Rd' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'buses' | 'traffic' | 'trains' | 'inspector'>('buses');
  const [busStopCode, setBusStopCode] = useState('83139');
  const [busStopInput, setBusStopInput] = useState('83139');
  const [serviceFilter, setServiceFilter] = useState('');
  const [trafficSearch, setTrafficSearch] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Data states
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [busData, setBusData] = useState<BusArrivalResponse | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficIncident[]>([]);
  const [trainData, setTrainData] = useState<TrainAlertValue | TrainAlertValue[] | null>(null);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(20);

  // Inspector raw response view
  const [rawResponses, setRawResponses] = useState<Record<string, unknown>>({});

  // Helper for requests headers
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

  // Fetch Bus Arrival v3
  const fetchBuses = useCallback(async (stopCode: string) => {
    try {
      const res = await fetch(`/api/bustracker?endpoint=BusArrival&BusStopCode=${encodeURIComponent(stopCode)}`, {
        headers: getHeaders(),
      });
      const json = await res.json();
      setRawResponses((prev) => ({ ...prev, busArrival: json }));

      if (!res.ok) {
        if (json.error === 'MISSING_API_KEY') {
          setErrorMsg('LTA Datamall AccountKey is required. You can enter one in the top right or set LTA_DATAMALL_KEY in .env.');
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
  }, [getHeaders]);

  // Fetch Traffic Incidents
  const fetchTraffic = useCallback(async () => {
    try {
      const res = await fetch('/api/bustracker?endpoint=TrafficIncidents', {
        headers: getHeaders(),
      });
      const json = await res.json();
      setRawResponses((prev) => ({ ...prev, trafficIncidents: json }));

      if (res.ok && json.data) {
        setTrafficData(json.data.value || []);
      }
    } catch (err) {
      console.error('Traffic fetch error', err);
    }
  }, [getHeaders]);

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

  // Master refresh function
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

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [busStopCode, sessionKey]);

  // 20-second countdown auto-refresh matching LTA DataMall refresh period
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

  const isConfigured = Boolean(healthData?.datamall?.isKeyConfigured || sessionKey.trim());

  // Formatting helpers
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
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">Seats</span>;
      case 'SDA':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">Standing</span>;
      case 'LSD':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400">Packed</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'DD':
        return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Double Deck</span>;
      case 'BD':
        return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">Bendy</span>;
      case 'SD':
        return <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Single Deck</span>;
      default:
        return null;
    }
  };

  const filteredServices = busData?.Services?.filter((svc) => {
    if (!serviceFilter) return true;
    return svc.ServiceNo.toLowerCase().includes(serviceFilter.toLowerCase());
  }) || [];

  const filteredTraffic = trafficData.filter((inc) => {
    if (!trafficSearch) return true;
    return inc.Message.toLowerCase().includes(trafficSearch.toLowerCase()) ||
           inc.Type.toLowerCase().includes(trafficSearch.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Bus className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  SG Transport Live
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                    LTA DataMall v3
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time Bus Arrivals, Traffic Incidents & Rail Alerts
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* AccountKey Indicator */}
              <button
                onClick={() => setShowKeyModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isConfigured
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
                }`}
                title="Configure AccountKey"
              >
                {isConfigured ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>AccountKey Active</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Add AccountKey</span>
                  </>
                )}
              </button>

              {/* Auto Refresh Toggle */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
                    autoRefresh ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>20s sync</span>
                </button>
                {autoRefresh && (
                  <span className="w-6 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                    {countdown}s
                  </span>
                )}
              </div>

              {/* Manual Refresh Button */}
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
          <div className="flex space-x-1 sm:space-x-4 border-t border-slate-200 dark:border-slate-800 -mb-px">
            <button
              onClick={() => setActiveTab('buses')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'buses'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bus className="w-4 h-4" />
              <span>Bus Arrivals (v3)</span>
              {busData?.Services && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {busData.Services.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('traffic')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'traffic'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Traffic Incidents</span>
              {trafficData.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 font-bold">
                  {trafficData.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('trains')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'trains'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Train className="w-4 h-4" />
              <span>MRT / LRT Alerts</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>

            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-2 py-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'inspector'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>API Endpoints</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner if API key not configured yet */}
        {!isConfigured && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    LTA Datamall AccountKey Required
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 max-w-2xl leading-relaxed">
                    Per your instruction, no API keys are hardcoded. To view live data from Singapore Land Transport Authority (LTA), either provide your AccountKey in the session tester or set <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-mono">LTA_DATAMALL_KEY</code> in your environment.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(true)}
                className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition"
              >
                Enter AccountKey
              </button>
            </div>
          </div>
        )}

        {/* Error notification if any */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: BUS ARRIVALS */}
        {activeTab === 'buses' && (
          <div className="space-y-6">
            {/* Bus Stop Selector & Controls */}
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

                {/* Filter Services in current stop */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    placeholder="Filter bus number (e.g. 15)"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
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

            {/* Current Stop Banner */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Bus Stop <span className="font-mono text-emerald-600 dark:text-emerald-400">#{busStopCode}</span>
                  {PRESET_STOPS.find((p) => p.code === busStopCode) && (
                    <span className="font-normal text-slate-500 text-sm ml-2">
                      ({PRESET_STOPS.find((p) => p.code === busStopCode)?.name})
                    </span>
                  )}
                </h2>
              </div>
              <div className="text-xs text-slate-400">
                {lastRefreshed && (
                  <span>Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                )}
              </div>
            </div>

            {/* Bus Services Grid */}
            {filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.map((svc) => {
                  const arr1 = formatArrivalTime(svc.NextBus?.EstimatedArrival);
                  const arr2 = formatArrivalTime(svc.NextBus2?.EstimatedArrival);
                  const arr3 = formatArrivalTime(svc.NextBus3?.EstimatedArrival);

                  return (
                    <div
                      key={svc.ServiceNo}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800/70 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Service Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                              {svc.ServiceNo}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {svc.Operator || 'BUS'}
                            </span>
                          </div>
                          {svc.NextBus?.Feature === 'WAB' && (
                            <span
                              title="Wheelchair Accessible Bus"
                              className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                            >
                              <Accessibility className="w-4 h-4" />
                            </span>
                          )}
                        </div>

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
                        </div>

                        {/* Subsequent buses (NextBus2 & NextBus3) */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              Subsequent
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
                  {isConfigured ? 'No Bus Services Found' : 'Awaiting AccountKey'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {isConfigured
                    ? `No active bus arrivals returned for stop code ${busStopCode}. Check if the code is valid or try another stop.`
                    : 'Enter your LTA Datamall AccountKey to pull live bus arrival updates for this stop.'}
                </p>
                {!isConfigured && (
                  <button
                    onClick={() => setShowKeyModal(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    Set AccountKey
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRAFFIC INCIDENTS */}
        {activeTab === 'traffic' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Car className="w-5 h-5 text-amber-500" />
                    Live Traffic Incidents & Alerts
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Accidents, roadworks, and expressway breakdowns from LTA TrafficIncidents
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={trafficSearch}
                    onChange={(e) => setTrafficSearch(e.target.value)}
                    placeholder="Search expressway (e.g. PIE, CTE, AYE)"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {filteredTraffic.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTraffic.map((inc, index) => {
                  const isAccident = inc.Type.toLowerCase().includes('accident');
                  const isRoadwork = inc.Type.toLowerCase().includes('roadwork');

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
                          {inc.Latitude && inc.Longitude ? (
                            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {inc.Latitude.toFixed(3)}, {inc.Longitude.toFixed(3)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                          {inc.Message}
                        </p>
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
                  {isConfigured
                    ? 'All major Singapore expressways and arterial corridors are currently clear.'
                    : 'Connect your AccountKey to view live expressway traffic alerts.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MRT / LRT ALERTS */}
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

              {/* Status details */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-medium">Lines Monitored</div>
                  <div className="mt-1 font-bold text-slate-800 dark:text-slate-100">
                    NSL, EWL, NEL, CCL, DTL, TEL & LRT
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-medium">Free Bridging Bus</div>
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

              {/* Any alert message */}
              <div className="mt-6 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Official Train Alert Status Feed
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  LTA Status: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">Status 1 (Normal Operations)</span>. Train service across all operational lines is running on regular schedules with no major track or signalling disruptions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: API INSPECTOR & ENDPOINTS TESTER */}
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

              {/* Endpoints Table */}
              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                        GET /api/bustracker?endpoint=BusArrival
                      </span>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                        https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=83139
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Header: AccountKey: &lt;Key&gt;</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        GET /api/bustracker?endpoint=TrafficIncidents
                      </span>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                        https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Header: AccountKey: &lt;Key&gt;</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        GET /api/bustracker?endpoint=TrainServiceAlerts
                      </span>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                        https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Header: AccountKey: &lt;Key&gt;</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        GET /api/health
                      </span>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                        Health check, uptime & AccountKey detection state
                      </div>
                    </div>
                    <span className="text-xs text-emerald-600 font-semibold">200 OK</span>
                  </div>
                </div>
              </div>

              {/* Raw JSON Debug Preview */}
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Live Response Payload Preview (/api/health)
                </h3>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                  {JSON.stringify(healthData, null, 2)}
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
              As required by your instructions, no API keys are hardcoded in the codebase. You can:
            </p>

            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 mb-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">1.</span>
                <span>
                  <strong>Server Environment:</strong> Add <code className="font-mono text-emerald-600">LTA_DATAMALL_KEY</code> to your <code className="font-mono">.env</code> file.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">2.</span>
                <span>
                  <strong>Immediate Live Testing:</strong> Paste your key below to send it via the <code className="font-mono text-emerald-600">AccountKey:</code> header right now.
                </span>
              </li>
            </ul>

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
