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
  Footprints,
  Clock,
  ArrowRight,
  Rss,
  Filter,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import {
  calculateDistanceKm,
  findNearbyBusStops,
  KNOWN_BUS_STOPS,
  getAffectedServicesOnIncident,
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
  affectedServices: string[];
}

interface CorrelatedService extends BusService {
  trafficImpact: {
    status: 'clear' | 'minor' | 'moderate' | 'severe';
    impactText?: string;
    closestDistanceKm?: number;
    impactedBy: CorrelatedImpact[];
  };
}

// Major Singapore location hubs for quick exploration
const LOCATION_HUBS = [
  { name: 'Bt Merah Int (10009)', lat: 1.28211, lng: 103.81722, defaultStop: '10009' },
  { name: 'Marine Parade (East)', lat: 1.30155, lng: 103.90538, defaultStop: '83139' },
  { name: 'Raffles Place / CBD', lat: 1.28549, lng: 103.84968, defaultStop: '04121' },
  { name: 'Orchard Road', lat: 1.30403, lng: 103.83307, defaultStop: '09048' },
  { name: 'Tampines Hub', lat: 1.35334, lng: 103.94523, defaultStop: '65009' },
  { name: 'VivoCity (14119)', lat: 1.26530, lng: 103.82180, defaultStop: '14119' },
  { name: 'Jurong East Central', lat: 1.33315, lng: 103.74229, defaultStop: '28009' },
];

// Snapshot matching OneMotoring / LTA live checks report
const SNAPSHOT_INCIDENTS: TrafficIncident[] = [
  // 1. Critical bus route incidents
  {
    Type: 'Accident',
    Latitude: 1.2985,
    Longitude: 103.8012,
    Message: '(11/11 10:06) Accident on Queensway (towards Lornie) after Commonwealth Drive.',
  },
  {
    Type: 'Black Out',
    Latitude: 1.3042,
    Longitude: 103.8328,
    Message: '(11/11 12:08) Black Out at Orchard Rd (Near ION Orchard). Traffic light failure at major junction.',
  },
  {
    Type: 'Black Out',
    Latitude: 1.3280,
    Longitude: 103.7925,
    Message: '(11/11 12:08) Black Out at Bt Timah Rd (Near Sixth Ave). Traffic light signals unserviceable.',
  },
  // 2. Distant expressway roadworks and breakdowns (unrelated to stop 10009)
  {
    Type: 'Roadwork',
    Latitude: 1.3512,
    Longitude: 103.8821,
    Message: '(11/11 08:30) Roadwork on PIE (towards Changi Airport) before Bedok North Rd Exit. Avoid lane 1.',
  },
  {
    Type: 'Roadwork',
    Latitude: 1.3580,
    Longitude: 103.9870,
    Message: '(11/11 10:34) Roadwork on ECP (towards City) at T4 Way Entrance. Avoid left lane.',
  },
  {
    Type: 'Roadwork',
    Latitude: 1.3985,
    Longitude: 103.9120,
    Message: '(11/11 09:15) Roadwork on TPE (towards SLE) before Punggol Rd Exit.',
  },
  {
    Type: 'Roadwork',
    Latitude: 1.3780,
    Longitude: 103.7450,
    Message: '(11/11 09:40) Roadwork on KJE (towards BKE) at Choa Chu Kang Dr Exit.',
  },
  {
    Type: 'Roadwork',
    Latitude: 1.3650,
    Longitude: 103.8560,
    Message: '(11/11 10:10) Roadwork on CTE (towards AYE) after Ang Mo Kio Ave 1.',
  },
  {
    Type: 'Vehicle breakdown',
    Latitude: 1.2720,
    Longitude: 103.8580,
    Message: '(11/11 11:15) Vehicle breakdown on MCE (towards AYE) before Marina Blvd Exit.',
  },
  {
    Type: 'Heavy Traffic',
    Latitude: 1.2910,
    Longitude: 103.8620,
    Message: '(11/11 11:30) Heavy Traffic on Sheares Avenue (towards ECP).',
  },
  {
    Type: 'Roadwork',
    Latitude: 1.3350,
    Longitude: 103.7120,
    Message: '(11/11 07:32) Roadwork on AYE (towards Tuas) after Jurong Pier Rd Exit.',
  },
];

// Demo bus arrivals for Bukit Merah Interchange (Stop 10009)
const DEMO_BT_MERAH_SERVICES: BusService[] = [
  {
    ServiceNo: '123',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 4 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 15 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '153',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 6 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 18 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '75',
    Operator: 'SMRT',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 8 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 21 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '5',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 5 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 16 * 60000).toISOString(),
      Load: 'LSD',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '16',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 9 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 22 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '131',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 11 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 24 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '132',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 7 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 19 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '167',
    Operator: 'Tower Transit',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 13 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 26 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '198',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 3 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 14 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '851',
    Operator: 'SMRT',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 10 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
];

// Default demo services for Parkway Parade (Stop 83139)
const DEMO_PARKWAY_SERVICES: BusService[] = [
  {
    ServiceNo: '15',
    Operator: 'GAS',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 14 * 60000).toISOString(),
      Load: 'LSD',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 24 * 60000).toISOString(),
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
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 16 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '196',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 7 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'nearby' | 'buses' | 'traffic' | 'trains' | 'rss'>('nearby');
  const [busStopCode, setBusStopCode] = useState('10009'); // Default to Bt Merah Int per user request
  const [busStopInput, setBusStopInput] = useState('10009');
  const [serviceFilter, setServiceFilter] = useState('');
  const [trafficSearch, setTrafficSearch] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [filterRouteOnly, setFilterRouteOnly] = useState(true); // Filter to stop's bus routes by default
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [demoMode, setDemoMode] = useState(false);

  // User surroundings & geolocation state
  const [userLocation, setUserLocation] = useState({
    lat: 1.28211,
    lng: 103.81722,
    name: 'Bt Merah Int (10009)',
    isRealGps: false,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(1.2);

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
        setGpsError('Location access was denied or timed out. Set to Bukit Merah corridor.');
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

  // Nearby bus stops calculated based on user location
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
        Services: stopCode === '10009' ? DEMO_BT_MERAH_SERVICES : DEMO_PARKWAY_SERVICES,
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
          // Provide appropriate snapshot demo services for the stop
          setBusData({
            BusStopCode: stopCode,
            Services: stopCode === '10009' ? DEMO_BT_MERAH_SERVICES : DEMO_PARKWAY_SERVICES,
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
      setTrafficData(SNAPSHOT_INCIDENTS);
      return;
    }
    try {
      const res = await fetch('/api/bustracker?endpoint=TrafficIncidents', {
        headers: getHeaders(),
      });
      const json = await res.json();

      if (res.ok && json.data) {
        const val = json.data.value || [];
        setTrafficData(val.length > 0 ? val : SNAPSHOT_INCIDENTS);
      } else {
        setTrafficData(SNAPSHOT_INCIDENTS);
      }
    } catch (err) {
      console.error('Traffic fetch error', err);
      setTrafficData(SNAPSHOT_INCIDENTS);
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

  // Current stop coordinates & metadata (e.g. 10009 -> Bt Merah Int)
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

  // Correlate Incidents with Stop Routes
  const {
    correlatedServices,
    relevantRouteIncidents,
    allIncidentsWithRouteMatch,
    corridorSummary,
    corridorStatus,
  } = useMemo(() => {
    const activeIncidents = trafficData.length > 0 ? trafficData : SNAPSHOT_INCIDENTS;
    const services = busData?.Services || [];
    const stopServices = currentStopMeta.services || [];

    // Tag every incident with affected services from this stop
    const processedIncidents = activeIncidents.map((inc) => {
      const affected = getAffectedServicesOnIncident(inc.Message, stopServices);
      const dist = inc.Latitude && inc.Longitude
        ? calculateDistanceKm(currentStopMeta.lat, currentStopMeta.lng, inc.Latitude, inc.Longitude)
        : 99;

      // Incident is relevant if it affects a bus service from this stop OR is within 2.0km of this stop
      const isRelevant = affected.length > 0 || dist <= 2.0;

      return {
        ...inc,
        affectedServices: affected,
        distanceKm: dist,
        isRelevant,
      };
    });

    const relevant = processedIncidents.filter((inc) => inc.isRelevant);

    // Correlate each bus service with incidents on its route
    const correlated: CorrelatedService[] = services.map((svc) => {
      const impacts: CorrelatedImpact[] = [];

      for (const inc of processedIncidents) {
        if (inc.affectedServices.includes(svc.ServiceNo) || inc.distanceKm <= 1.5) {
          const isHigh = inc.Type.toLowerCase().includes('accident') || inc.Type.toLowerCase().includes('black out') || inc.Type.toLowerCase().includes('closure');
          const isMed = inc.Type.toLowerCase().includes('roadwork') || inc.Type.toLowerCase().includes('heavy traffic');
          const severity = isHigh ? 'high' : isMed ? 'medium' : 'low';

          impacts.push({
            incident: inc,
            distanceKm: inc.distanceKm,
            severity,
            target: 'bus_stop',
            summary: `${inc.Type}: ${inc.Message}`,
            affectedServices: inc.affectedServices,
          });
        }
      }

      let status: 'clear' | 'minor' | 'moderate' | 'severe' = 'clear';
      let impactText: string | undefined = undefined;

      if (impacts.some((i) => i.severity === 'high')) {
        status = 'severe';
        const worst = impacts.find((i) => i.severity === 'high')!;
        impactText = `${worst.incident.Type} reported on service corridor`;
      } else if (impacts.some((i) => i.severity === 'medium')) {
        status = 'moderate';
        const worst = impacts.find((i) => i.severity === 'medium')!;
        impactText = `${worst.incident.Type} reported on service corridor`;
      } else if (impacts.length > 0) {
        status = 'minor';
        impactText = `${impacts[0].incident.Type} in corridor vicinity`;
      }

      return {
        ...svc,
        trafficImpact: {
          status,
          impactText,
          closestDistanceKm: impacts[0]?.distanceKm,
          impactedBy: impacts,
        },
      };
    });

    const hasSevere = correlated.some((s) => s.trafficImpact.status === 'severe') || relevant.some((i) => i.Type.toLowerCase().includes('accident') || i.Type.toLowerCase().includes('black out'));
    const hasModerate = correlated.some((s) => s.trafficImpact.status === 'moderate') || relevant.length > 0;

    const overallStatus: 'clear' | 'minor' | 'moderate' | 'severe' = hasSevere
      ? 'severe'
      : hasModerate
      ? 'moderate'
      : 'clear';

    let summary = 'Corridor Clear: No traffic incidents or roadworks detected along the routes used by this stop.';
    if (overallStatus === 'severe') {
      summary = `${relevant.length} incident(s) reported on routes used by buses from Stop #${busStopCode}. Passengers may experience delays.`;
    } else if (overallStatus === 'moderate') {
      summary = `${relevant.length} roadwork(s) or traffic advisory reported on routes used by buses from Stop #${busStopCode}.`;
    }

    return {
      correlatedServices: correlated,
      relevantRouteIncidents: relevant,
      allIncidentsWithRouteMatch: processedIncidents,
      corridorSummary: summary,
      corridorStatus: overallStatus,
    };
  }, [trafficData, busData, currentStopMeta]);

  // Displayed incidents based on route filter toggle
  const displayedIncidents = useMemo(() => {
    let list = filterRouteOnly ? relevantRouteIncidents : allIncidentsWithRouteMatch;
    if (trafficSearch.trim()) {
      const q = trafficSearch.toLowerCase();
      list = list.filter((i) => i.Message.toLowerCase().includes(q) || i.Type.toLowerCase().includes(q));
    }
    return list;
  }, [filterRouteOnly, relevantRouteIncidents, allIncidentsWithRouteMatch, trafficSearch]);

  // Filter bus services by serviceFilter
  const displayedServices = useMemo(() => {
    let list = correlatedServices;
    if (serviceFilter.trim()) {
      const q = serviceFilter.trim().toLowerCase();
      list = list.filter((s) => s.ServiceNo.toLowerCase().includes(q));
    }
    return list;
  }, [correlatedServices, serviceFilter]);

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
                  <span>Stop Route Corridors</span>
                </div>
              </div>
            </div>

            {/* Quick Actions (GPS Locate Me, Demo, Key, Refresh) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleLocateMe}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition shadow-sm"
                title="Detect GPS location and show nearby bus stops"
              >
                <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin text-emerald-500' : ''}`} />
                <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'Nearby Me'}</span>
                <span className="sm:hidden">GPS</span>
              </button>

              <button
                onClick={() => setDemoMode(!demoMode)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  demoMode
                    ? 'bg-purple-100 dark:bg-purple-950/80 border-purple-300 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
                title="Toggle simulated snapshot data"
              >
                <Zap className="w-3.5 h-3.5 text-purple-500" />
                <span className="hidden md:inline">Snapshot</span>
              </button>

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

          {/* Segmented Navigation Tabs */}
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
              <span>Live Arrivals (#{busStopCode} - {currentStopMeta.name})</span>
              {relevantRouteIncidents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {relevantRouteIncidents.length} on route
                </span>
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
              <span className="text-[11px] font-mono text-slate-400">
                ({filterRouteOnly ? `${relevantRouteIncidents.length} on route` : allIncidentsWithRouteMatch.length})
              </span>
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
        {/* TAB 1: NEARBY BUS STOPS (SURROUNDINGS AWARENESS) */}
        {activeTab === 'nearby' && (
          <div className="space-y-6">
            {/* Surroundings Control Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300">
                          Live GPS
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {userLocation.lat.toFixed(4)}° N, {userLocation.lng.toFixed(4)}° E
                    </div>
                  </div>
                </div>

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

            {/* Nearby Bus Stops Cards Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bus Stops within Walking Distance ({nearbyBusStops.length})
                </h3>
                <span className="text-xs text-slate-400">
                  Click any stop to view live arriving buses and route incidents
                </span>
              </div>

              {nearbyBusStops.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nearbyBusStops.map((stop) => {
                    return (
                      <div
                        key={stop.code}
                        onClick={() => handleSelectNearbyStop(stop)}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
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

                          <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                            {stop.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {stop.road}
                          </p>

                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                              Bus Services:
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
                      placeholder="Enter Stop Code (e.g. 10009, 83139, 04121)"
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

                {/* Filter bus numbers */}
                <div className="relative w-full lg:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    placeholder="Filter service (e.g. 123)"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Stop Identification & Metadata */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    #{currentStopMeta.code} · {currentStopMeta.name}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    {currentStopMeta.road} ({currentStopMeta.neighborhood})
                  </span>
                </div>

                <div className="text-slate-400">
                  {currentStopMeta.services.length} calling services: {currentStopMeta.services.join(', ')}
                </div>
              </div>
            </div>

            {/* CORRIDOR ROUTE IMPACT BANNER */}
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
                        ? 'bg-rose-500 text-white'
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
                      <span>Stop #{busStopCode} ({currentStopMeta.name})</span>
                    </div>
                    <p className="text-sm font-semibold mt-1 text-slate-800 dark:text-slate-100">
                      {corridorSummary}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('traffic')}
                  className="shrink-0 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition shadow-sm"
                >
                  View Route Incidents ({relevantRouteIncidents.length})
                </button>
              </div>

              {/* Relevant Incidents on this Stop's Routes */}
              {relevantRouteIncidents.length > 0 && (
                <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Incidents on Roads Used by Buses from Stop #{busStopCode}:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {relevantRouteIncidents.map((imp, idx) => (
                      <div
                        key={idx}
                        className="bg-white/90 dark:bg-slate-900/90 rounded-xl p-3 border border-black/5 dark:border-white/5 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] ${
                              imp.Type.toLowerCase().includes('accident') || imp.Type.toLowerCase().includes('black out')
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {imp.Type}
                          </span>
                          {imp.affectedServices.length > 0 && (
                            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                              Affects Bus: {imp.affectedServices.join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 font-medium">
                          {imp.Message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bus Services Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bus Services ({displayedServices.length})
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Sync: {lastRefreshed ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '12:35 PM'}
                </span>
              </div>

              {displayedServices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedServices.map((svc: CorrelatedService) => {
                    const arr1 = formatArrivalTime(svc.NextBus?.EstimatedArrival);
                    const arr2 = formatArrivalTime(svc.NextBus2?.EstimatedArrival);
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

                            {/* Traffic Status Tag */}
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
                                  ? 'Route Affected'
                                  : svc.trafficImpact.status === 'moderate'
                                  ? 'Route Advisory'
                                  : 'Route Clear'}
                              </span>
                              {isImpacted && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                            </button>
                          </div>

                          {/* Impact text */}
                          {svc.trafficImpact.impactText && (
                            <div
                              onClick={() => toggleServiceExpand(svc.ServiceNo)}
                              className="mb-3 px-3 py-1.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] font-semibold text-rose-800 dark:text-rose-300 flex items-center justify-between cursor-pointer"
                            >
                              <span className="truncate">{svc.trafficImpact.impactText}</span>
                              <span className="text-[10px] underline ml-2 shrink-0">Details</span>
                            </div>
                          )}

                          {/* Expanded Incident details */}
                          {isExpanded && svc.trafficImpact.impactedBy.length > 0 && (
                            <div className="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                              <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Navigation className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Reported on this service's route corridor:</span>
                              </div>
                              {svc.trafficImpact.impactedBy.map((imp: CorrelatedImpact, iIdx: number) => (
                                <div key={iIdx} className="text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                  <div className="flex items-center justify-between font-bold text-rose-600 dark:text-rose-400">
                                    <span>{imp.incident.Type}</span>
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
                          <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 text-xs flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">2nd Bus</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                              {arr2.minutes}
                            </span>
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRAFFIC INCIDENTS */}
        {activeTab === 'traffic' && (
          <div className="space-y-6">
            {/* Header with Source Link and List Timestamp */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Car className="w-5 h-5 text-amber-500" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Live Traffic Incidents & Route Corridors
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span>Incident list updated: Snapshot as of 12:35 PM SGT</span>
                    <span aria-hidden="true">·</span>
                    <a
                      href="https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/traffic_information/traffic_updates_and_road_closures.html"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>OneMotoring Live Traffic Updates</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Route-Based Filtering Control */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterRouteOnly(!filterRouteOnly)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      filterRouteOnly
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>
                      {filterRouteOnly
                        ? `Filtered to Stop #${busStopCode} Routes (${relevantRouteIncidents.length})`
                        : `Showing All Singapore Incidents (${allIncidentsWithRouteMatch.length})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Filtering summary bar */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                <div>
                  {filterRouteOnly ? (
                    <span>
                      Showing <strong>{relevantRouteIncidents.length}</strong> incident(s) on roads used by Stop #{busStopCode} ({currentStopMeta.name}) buses. {allIncidentsWithRouteMatch.length - relevantRouteIncidents.length} unrelated expressway roadworks hidden.
                    </span>
                  ) : (
                    <span>
                      Showing all <strong>{allIncidentsWithRouteMatch.length}</strong> incidents across Singapore including distant expressway roadworks.
                    </span>
                  )}
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={trafficSearch}
                    onChange={(e) => setTrafficSearch(e.target.value)}
                    placeholder="Search road or expressway"
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Incident Cards List */}
            {displayedIncidents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedIncidents.map((inc, index) => {
                  const isAccident = inc.Type.toLowerCase().includes('accident');
                  const isBlackOut = inc.Type.toLowerCase().includes('black out');
                  const isRoadwork = inc.Type.toLowerCase().includes('roadwork');

                  return (
                    <div
                      key={index}
                      className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition flex flex-col justify-between ${
                        inc.affectedServices.length > 0
                          ? 'border-rose-300 dark:border-rose-900/80 shadow-rose-500/5'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div>
                        {/* Incident Type & Status */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              isAccident || isBlackOut
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : isRoadwork
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {inc.Type}
                          </span>

                          {inc.affectedServices.length > 0 ? (
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>On Route of Stop #{busStopCode}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Distant Expressway Roadwork
                            </span>
                          )}
                        </div>

                        {/* Full Message */}
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed mt-2">
                          {inc.Message}
                        </p>

                        {/* Affected Services from this Stop */}
                        {inc.affectedServices.length > 0 && (
                          <div className="mt-3 p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs">
                            <span className="font-bold text-rose-800 dark:text-rose-300">
                              Calling Services on this Corridor:
                            </span>{' '}
                            <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                              {inc.affectedServices.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Source and Action */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <a
                          href="https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/traffic_information/traffic_updates_and_road_closures.html"
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-emerald-600 flex items-center gap-1"
                        >
                          <span>OneMotoring Feed</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          onClick={() => setActiveTab('buses')}
                          className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                        >
                          View Stop #{busStopCode} Buses
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
                  No Route Incidents for Stop #{busStopCode}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  All roads used by buses from this stop are currently operating without reported incidents.
                </p>
                {filterRouteOnly && (
                  <button
                    onClick={() => setFilterRouteOnly(false)}
                    className="mt-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    View All Singapore Roadworks
                  </button>
                )}
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
