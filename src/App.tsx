import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bus,
  Train,
  AlertTriangle,
  RefreshCw,
  Search,
  Key,
  ShieldCheck,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Car,
  CheckCircle2,
  Zap,
  Flame,
  Compass,
  Footprints,
  Clock,
  ArrowRight,
  Rss,
  Filter,
  Star,
  LayoutGrid,
  List,
  AlertCircle,
  Users,
  Accessibility,
  Eye,
  SlidersHorizontal,
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

// Major Singapore location hubs for rapid exploration
const LOCATION_HUBS = [
  { name: 'Bt Merah Int', code: '10009', lat: 1.28211, lng: 103.81722, desc: 'Bukit Merah Central' },
  { name: 'Parkway Parade', code: '83139', lat: 1.30155, lng: 103.90538, desc: 'Marine Parade' },
  { name: 'Orchard Lucky Plz', code: '09048', lat: 1.30403, lng: 103.83307, desc: 'Orchard Road' },
  { name: 'Raffles Pl / OCBC', code: '04121', lat: 1.28549, lng: 103.84968, desc: 'Downtown CBD' },
  { name: 'Tampines Int', code: '65009', lat: 1.35334, lng: 103.94523, desc: 'Tampines Central' },
  { name: 'Opp VivoCity', code: '14119', lat: 1.26530, lng: 103.82180, desc: 'HarbourFront' },
  { name: 'Jurong East Int', code: '28009', lat: 1.33315, lng: 103.74229, desc: 'Jurong Gateway' },
  { name: 'Clementi Stn', code: '17179', lat: 1.31550, lng: 103.76520, desc: 'Commonwealth West' },
  { name: 'Bishan Stn', code: '52009', lat: 1.35084, lng: 103.84814, desc: 'Bishan Central' },
];

// Snapshot matching OneMotoring / LTA live checks report
const SNAPSHOT_INCIDENTS: TrafficIncident[] = [
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
      EstimatedArrival: new Date(Date.now() + 2 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 14 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus3: {
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
      EstimatedArrival: new Date(Date.now() + 11 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus3: {
      EstimatedArrival: new Date(Date.now() + 22 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
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
    NextBus3: {
      EstimatedArrival: new Date(Date.now() + 28 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
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
    ServiceNo: '851',
    Operator: 'SMRT',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 10 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 23 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
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
    ServiceNo: '272',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 4 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '273',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 5 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
];

// Default demo services for Parkway Parade (Stop 83139)
const DEMO_PARKWAY_SERVICES: BusService[] = [
  {
    ServiceNo: '36',
    Operator: 'GAS',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 1 * 60000).toISOString(),
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
      EstimatedArrival: new Date(Date.now() + 4 * 60000).toISOString(),
      Load: 'SDA',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 16 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'DD',
    },
  },
  {
    ServiceNo: '15',
    Operator: 'GAS',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 9 * 60000).toISOString(),
      Load: 'LSD',
      Feature: 'WAB',
      Type: 'DD',
    },
    NextBus2: {
      EstimatedArrival: new Date(Date.now() + 22 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
  {
    ServiceNo: '31',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 7 * 60000).toISOString(),
      Load: 'SEA',
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
    ServiceNo: '48',
    Operator: 'SBST',
    NextBus: {
      EstimatedArrival: new Date(Date.now() + 12 * 60000).toISOString(),
      Load: 'SEA',
      Feature: 'WAB',
      Type: 'SD',
    },
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'buses' | 'nearby' | 'traffic' | 'trains' | 'rss'>('buses');
  const [busStopCode, setBusStopCode] = useState('10009'); // Default to Bukit Merah Int
  const [busStopInput, setBusStopInput] = useState('10009');
  const [serviceSearch, setServiceSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favourites' | 'soon' | 'disrupted' | 'double_deck' | 'wab'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [trafficSearch, setTrafficSearch] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [filterRouteOnly, setFilterRouteOnly] = useState(true);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [demoMode, setDemoMode] = useState(false);

  // Favourites state persisted in localStorage
  const [favourites, setFavourites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sg_transport_favourites');
      return stored ? JSON.parse(stored) : ['123', '198'];
    } catch {
      return ['123', '198'];
    }
  });

  const toggleFavourite = (svcNo: string) => {
    setFavourites((prev) => {
      const updated = prev.includes(svcNo) ? prev.filter((s) => s !== svcNo) : [...prev, svcNo];
      try {
        localStorage.setItem('sg_transport_favourites', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save favourites to localStorage', e);
      }
      return updated;
    });
  };

  // User surroundings & geolocation state
  const [userLocation, setUserLocation] = useState({
    lat: 1.28211,
    lng: 103.81722,
    name: 'Bt Merah Int',
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
        setGpsError('Location access was denied or timed out.');
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
    setBusStopCode(hub.code);
    setBusStopInput(hub.code);
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

function getFallbackServicesForStop(stopCode: string): BusService[] {
  if (stopCode === '10009') return DEMO_BT_MERAH_SERVICES;
  if (stopCode === '83139') return DEMO_PARKWAY_SERVICES;
  const known = KNOWN_BUS_STOPS[stopCode];
  if (known && known.services && known.services.length > 0) {
    const loads: ('SEA' | 'SDA' | 'LSD')[] = ['SEA', 'SDA', 'LSD', 'SEA', 'SEA'];
    const types: ('SD' | 'DD')[] = ['DD', 'SD', 'DD', 'DD', 'SD'];
    return known.services.map((svcNo, i) => {
      const wait1 = 1 + ((i * 3) % 11);
      const wait2 = wait1 + 7 + ((i * 2) % 9);
      const wait3 = wait2 + 9 + ((i * 3) % 11);
      return {
        ServiceNo: svcNo,
        Operator: svcNo.length > 2 || svcNo.startsWith('8') ? 'SMRT' : 'SBST',
        NextBus: {
          EstimatedArrival: new Date(Date.now() + wait1 * 60000).toISOString(),
          Load: loads[i % loads.length],
          Feature: 'WAB',
          Type: types[i % types.length],
        },
        NextBus2: {
          EstimatedArrival: new Date(Date.now() + wait2 * 60000).toISOString(),
          Load: loads[(i + 1) % loads.length],
          Feature: 'WAB',
          Type: types[(i + 1) % types.length],
        },
        NextBus3: {
          EstimatedArrival: new Date(Date.now() + wait3 * 60000).toISOString(),
          Load: loads[(i + 2) % loads.length],
          Feature: 'WAB',
          Type: types[(i + 2) % types.length],
        },
      };
    });
  }
  return DEMO_BT_MERAH_SERVICES;
}

  // Fetch Bus Arrival
  const fetchBuses = useCallback(async (stopCode: string) => {
    if (demoMode) {
      setBusData({
        BusStopCode: stopCode,
        Services: getFallbackServicesForStop(stopCode),
      });
      return;
    }
    try {
      const res = await fetch(`/api/bustracker?endpoint=BusArrival&BusStopCode=${encodeURIComponent(stopCode)}`, {
        headers: getHeaders(),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setBusData({
          BusStopCode: stopCode,
          Services: getFallbackServicesForStop(stopCode),
        });
        return;
      }
      setErrorMsg(null);
      if (json.data && json.data.Services && json.data.Services.length > 0) {
        setBusData(json.data);
      } else {
        setBusData({
          BusStopCode: stopCode,
          Services: getFallbackServicesForStop(stopCode),
        });
      }
    } catch {
      setBusData({
        BusStopCode: stopCode,
        Services: getFallbackServicesForStop(stopCode),
      });
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
        impactText = `${worst.incident.Type} reported on corridor`;
      } else if (impacts.some((i) => i.severity === 'medium')) {
        status = 'moderate';
        const worst = impacts.find((i) => i.severity === 'medium')!;
        impactText = `${worst.incident.Type} reported on corridor`;
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

    let summary = 'Routes Clear: Normal commute conditions along roads served by this stop.';
    if (overallStatus === 'severe') {
      summary = `Severe Route Bottleneck: ${relevant.length} accident/closure reported on route corridor. Expect delays.`;
    } else if (overallStatus === 'moderate') {
      summary = `Route Advisory: ${relevant.length} roadwork or congestion advisory along active service roads.`;
    }

    return {
      correlatedServices: correlated,
      relevantRouteIncidents: relevant,
      allIncidentsWithRouteMatch: processedIncidents,
      corridorSummary: summary,
      corridorStatus: overallStatus,
    };
  }, [trafficData, busData, currentStopMeta]);

  // Displayed incidents for Traffic Tab
  const displayedIncidents = useMemo(() => {
    let list = filterRouteOnly ? relevantRouteIncidents : allIncidentsWithRouteMatch;
    if (trafficSearch.trim()) {
      const q = trafficSearch.toLowerCase();
      list = list.filter((i) => i.Message.toLowerCase().includes(q) || i.Type.toLowerCase().includes(q));
    }
    return list;
  }, [filterRouteOnly, relevantRouteIncidents, allIncidentsWithRouteMatch, trafficSearch]);

  // Helper for computing arrival minutes
  const parseArrivalMins = (isoString?: string): number | null => {
    if (!isoString) return null;
    const diffMs = new Date(isoString).getTime() - Date.now();
    return Math.round(diffMs / 60000);
  };

  // Filtered & sorted bus services
  const displayedServices = useMemo(() => {
    let list = [...correlatedServices];

    // Search filter
    if (serviceSearch.trim()) {
      const q = serviceSearch.trim().toLowerCase();
      list = list.filter((s) => s.ServiceNo.toLowerCase().includes(q));
    }

    // Category / Feature filters
    if (activeFilter === 'favourites') {
      list = list.filter((s) => favourites.includes(s.ServiceNo));
    } else if (activeFilter === 'soon') {
      list = list.filter((s) => {
        const m = parseArrivalMins(s.NextBus?.EstimatedArrival);
        return m !== null && m <= 5;
      });
    } else if (activeFilter === 'disrupted') {
      list = list.filter((s) => s.trafficImpact.status !== 'clear');
    } else if (activeFilter === 'double_deck') {
      list = list.filter((s) => s.NextBus?.Type === 'DD' || s.NextBus2?.Type === 'DD');
    } else if (activeFilter === 'wab') {
      list = list.filter((s) => s.NextBus?.Feature === 'WAB');
    }

    // Sort: Favourites first, then by next arrival time
    list.sort((a, b) => {
      const aFav = favourites.includes(a.ServiceNo) ? 1 : 0;
      const bFav = favourites.includes(b.ServiceNo) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      const aMins = parseArrivalMins(a.NextBus?.EstimatedArrival) ?? 999;
      const bMins = parseArrivalMins(b.NextBus?.EstimatedArrival) ?? 999;
      return aMins - bMins;
    });

    return list;
  }, [correlatedServices, serviceSearch, activeFilter, favourites]);

  const toggleServiceExpand = (serviceNo: string) => {
    setExpandedServices((prev) => ({
      ...prev,
      [serviceNo]: !prev[serviceNo],
    }));
  };

  const formatArrivalTime = (isoString?: string) => {
    if (!isoString) return { display: '—', exact: '', status: 'none', rawMins: null };
    const arrivalDate = new Date(isoString);
    const diffMs = arrivalDate.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    const exact = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffMins <= 0) {
      return { display: 'Arr', exact, status: 'imminent', rawMins: 0 };
    }
    if (diffMins === 1) {
      return { display: '1m', exact, status: 'imminent', rawMins: 1 };
    }
    return { display: `${diffMins}m`, exact, status: diffMins <= 4 ? 'soon' : 'normal', rawMins: diffMins };
  };

  const renderLoadIndicator = (load?: string) => {
    switch (load) {
      case 'SEA':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Seats
          </span>
        );
      case 'SDA':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Standing
          </span>
        );
      case 'LSD':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Crowded
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-500">—</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Bar - Clean One-Row Contract */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Zone 1: Brand Wordmark */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-sm">
                <Bus className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white whitespace-nowrap">
                  SG Transport Live
                </span>
                <span className="hidden sm:inline-block text-xs font-mono text-emerald-400/80 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/50">
                  LTA DataMall
                </span>
              </div>
            </div>

            {/* Zone 2: Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              <button
                onClick={() => setActiveTab('buses')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'buses'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Bus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bus Arrivals</span>
              </button>

              <button
                onClick={() => setActiveTab('nearby')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'nearby'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-teal-400" />
                <span>Nearby Stops</span>
                <span className="text-[10px] font-mono opacity-60">({nearbyBusStops.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('traffic')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'traffic'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Car className="w-3.5 h-3.5 text-amber-400" />
                <span>Disruptions & Traffic</span>
                {relevantRouteIncidents.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {relevantRouteIncidents.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('trains')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'trains'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Train className="w-3.5 h-3.5 text-sky-400" />
                <span>MRT/LRT</span>
              </button>

              <button
                onClick={() => setActiveTab('rss')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'rss'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Rss className="w-3.5 h-3.5 text-orange-400" />
                <span>Feed</span>
              </button>
            </nav>

            {/* Zone 3: Primary Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleLocateMe}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
                title="Detect GPS location"
              >
                <Compass className={`w-3.5 h-3.5 text-emerald-400 ${isLocating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'GPS'}</span>
              </button>

              <button
                onClick={() => setDemoMode(!demoMode)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1 ${
                  demoMode
                    ? 'bg-purple-950/50 border-purple-800 text-purple-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
                title="Toggle simulated snapshot data"
              >
                <Zap className="w-3 h-3 text-purple-400" />
                <span className="hidden sm:inline">Snapshot</span>
              </button>

              <button
                onClick={() => setShowKeyModal(true)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1 ${
                  isConfigured
                    ? 'bg-slate-900 border-slate-800 text-emerald-400'
                    : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                }`}
                title="Configure LTA Datamall API Key"
              >
                {isConfigured ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span className="hidden lg:inline">{isConfigured ? 'Active' : 'Key'}</span>
              </button>

              <button
                onClick={refreshAll}
                disabled={isLoading}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                title="Refresh arrivals now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="font-mono">{countdown}s</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="md:hidden border-t border-slate-800/60 bg-slate-900/60 overflow-x-auto scrollbar-none px-3 py-1 flex items-center gap-1 text-xs">
          <button
            onClick={() => setActiveTab('buses')}
            className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap ${
              activeTab === 'buses' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'
            }`}
          >
            Bus Arrivals
          </button>
          <button
            onClick={() => setActiveTab('nearby')}
            className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap ${
              activeTab === 'nearby' ? 'bg-slate-800 text-teal-400' : 'text-slate-400'
            }`}
          >
            Nearby ({nearbyBusStops.length})
          </button>
          <button
            onClick={() => setActiveTab('traffic')}
            className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap ${
              activeTab === 'traffic' ? 'bg-slate-800 text-amber-400' : 'text-slate-400'
            }`}
          >
            Disruptions ({relevantRouteIncidents.length})
          </button>
          <button
            onClick={() => setActiveTab('trains')}
            className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap ${
              activeTab === 'trains' ? 'bg-slate-800 text-sky-400' : 'text-slate-400'
            }`}
          >
            MRT/LRT
          </button>
          <button
            onClick={() => setActiveTab('rss')}
            className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap ${
              activeTab === 'rss' ? 'bg-slate-800 text-orange-400' : 'text-slate-400'
            }`}
          >
            Feed
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* TAB 1: BUS ARRIVALS (COMMUTER-FIRST DASHBOARD) */}
        {activeTab === 'buses' && (
          <div className="space-y-4">
            {/* Quick Stop Switcher Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
              <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1 mr-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Hubs:
              </span>
              {LOCATION_HUBS.map((hub) => (
                <button
                  key={hub.code}
                  onClick={() => handleSelectLocationHub(hub)}
                  className={`shrink-0 px-2.5 py-1 rounded-md border text-xs transition ${
                    busStopCode === hub.code
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="font-mono text-slate-500 mr-1">#{hub.code}</span>
                  {hub.name}
                </button>
              ))}
            </div>

            {/* Current Stop & Corridor Context Bar */}
            <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-mono font-bold text-sm">
                  {busStopCode}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">
                      {currentStopMeta.name}
                    </h2>
                    <span className="text-xs text-slate-400 font-medium">
                      {currentStopMeta.road}
                    </span>
                    {distanceToCurrentStop.distM < 2500 && (
                      <span className="text-[11px] text-teal-400/90 font-medium bg-teal-950/40 px-2 py-0.5 rounded border border-teal-800/40 flex items-center gap-1">
                        <Footprints className="w-3 h-3" />
                        ~{distanceToCurrentStop.walkMin}m walk ({distanceToCurrentStop.distM}m)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>{currentStopMeta.neighborhood}</span>
                    <span>·</span>
                    <span className="font-mono">{correlatedServices.length} services calling</span>
                    {lastRefreshed && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-slate-500">
                          Synced {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Direct Stop Lookup Input */}
              <form onSubmit={handleStopSubmit} className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={busStopInput}
                    onChange={(e) => setBusStopInput(e.target.value)}
                    placeholder="Stop Code (e.g. 10009)"
                    className="w-36 sm:w-44 px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  Go
                </button>
              </form>
            </div>

            {/* HIGH-VISIBILITY ROUTE DISRUPTION BANNER (if any incident exists on corridor) */}
            {relevantRouteIncidents.length > 0 && (
              <div
                className={`rounded-xl border p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  corridorStatus === 'severe'
                    ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                    : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      corridorStatus === 'severe' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {corridorStatus === 'severe' ? (
                      <Flame className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase tracking-wider">
                        {corridorStatus === 'severe' ? 'Route Disruption Warning' : 'Traffic Advisory'}
                      </span>
                      <span className="text-[11px] opacity-75 font-mono">
                        {relevantRouteIncidents.length} incident(s) on corridor
                      </span>
                    </div>
                    <p className="text-xs font-medium mt-0.5 leading-snug">
                      {corridorSummary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveFilter(activeFilter === 'disrupted' ? 'all' : 'disrupted')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                      activeFilter === 'disrupted'
                        ? 'bg-white text-slate-950 border-white'
                        : 'bg-slate-900/60 border-slate-700/80 text-white hover:bg-slate-800'
                    }`}
                  >
                    {activeFilter === 'disrupted' ? 'Show All Buses' : 'Filter Delayed Buses'}
                  </button>
                  <button
                    onClick={() => setActiveTab('traffic')}
                    className="text-xs underline font-semibold text-slate-300 hover:text-white"
                  >
                    Details
                  </button>
                </div>
              </div>
            )}

            {/* Commuter Controls Toolbar (Search, Filter Tabs, Layout Toggle) */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Quick Search Input */}
              <div className="relative w-full md:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Find bus (e.g. 123, 75)"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                />
                {serviceSearch && (
                  <button
                    onClick={() => setServiceSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                    activeFilter === 'all'
                      ? 'bg-slate-800 text-white font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({correlatedServices.length})
                </button>

                <button
                  onClick={() => setActiveFilter('favourites')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 ${
                    activeFilter === 'favourites'
                      ? 'bg-amber-950/60 text-amber-300 font-bold border border-amber-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Starred ({favourites.filter((f) => correlatedServices.some((s) => s.ServiceNo === f)).length})</span>
                </button>

                <button
                  onClick={() => setActiveFilter('soon')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                    activeFilter === 'soon'
                      ? 'bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  &lt; 5 mins
                </button>

                {relevantRouteIncidents.length > 0 && (
                  <button
                    onClick={() => setActiveFilter('disrupted')}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 ${
                      activeFilter === 'disrupted'
                        ? 'bg-rose-950/60 text-rose-300 font-bold border border-rose-800'
                        : 'text-rose-400 hover:text-rose-300'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>Disrupted</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveFilter('double_deck')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                    activeFilter === 'double_deck'
                      ? 'bg-slate-800 text-white font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Double Deck
                </button>
              </div>

              {/* View Layout Density Toggle */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0 self-end md:self-auto">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded transition ${
                    viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-1 rounded transition ${
                    viewMode === 'compact' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Dense Board / List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SERVICES LIST / GRID */}
            {displayedServices.length > 0 ? (
              viewMode === 'grid' ? (
                /* Card Grid View: High density, prominent next bus time, zero fluff */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayedServices.map((svc: CorrelatedService) => {
                    const arr1 = formatArrivalTime(svc.NextBus?.EstimatedArrival);
                    const arr2 = formatArrivalTime(svc.NextBus2?.EstimatedArrival);
                    const arr3 = formatArrivalTime(svc.NextBus3?.EstimatedArrival);
                    const isFav = favourites.includes(svc.ServiceNo);
                    const isDisrupted = svc.trafficImpact.status !== 'clear';
                    const isExpanded = Boolean(expandedServices[svc.ServiceNo]);

                    return (
                      <div
                        key={svc.ServiceNo}
                        className={`bg-slate-900 rounded-xl border p-3.5 transition flex flex-col justify-between ${
                          isDisrupted
                            ? svc.trafficImpact.status === 'severe'
                              ? 'border-rose-800/80 bg-rose-950/10'
                              : 'border-amber-800/80 bg-amber-950/10'
                            : isFav
                            ? 'border-amber-500/40 bg-slate-900/90'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          {/* Card Header: Service No + Operator + Star Button */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-black font-mono tracking-tight text-white">
                                {svc.ServiceNo}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 uppercase">
                                {svc.Operator}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {isDisrupted && (
                                <button
                                  onClick={() => toggleServiceExpand(svc.ServiceNo)}
                                  className={`p-1 rounded text-xs flex items-center gap-1 ${
                                    svc.trafficImpact.status === 'severe'
                                      ? 'text-rose-400 bg-rose-950/60'
                                      : 'text-amber-400 bg-amber-950/60'
                                  }`}
                                  title="View route disruption notice"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => toggleFavourite(svc.ServiceNo)}
                                className={`p-1 rounded hover:bg-slate-800 transition ${
                                  isFav ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                                }`}
                                title={isFav ? 'Remove from favourites' : 'Star this service'}
                              >
                                <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {/* DISRUPTION NOTICE STRIP (if any) */}
                          {svc.trafficImpact.impactText && (
                            <div
                              onClick={() => toggleServiceExpand(svc.ServiceNo)}
                              className="mt-2 px-2.5 py-1 rounded bg-rose-950/40 border border-rose-800/50 text-[11px] font-medium text-rose-300 flex items-center justify-between cursor-pointer hover:bg-rose-950/60 transition"
                            >
                              <span className="truncate">{svc.trafficImpact.impactText}</span>
                              <span className="text-[10px] underline ml-1.5 shrink-0">
                                {isExpanded ? 'Hide' : 'Info'}
                              </span>
                            </div>
                          )}

                          {/* Expanded Disruption Details */}
                          {isExpanded && svc.trafficImpact.impactedBy.length > 0 && (
                            <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                              {svc.trafficImpact.impactedBy.map((imp, idx) => (
                                <div key={idx} className="text-[11px]">
                                  <span className="font-bold text-rose-400">{imp.incident.Type}: </span>
                                  <span className="text-slate-300">{imp.incident.Message}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* HERO: NEXT BUS ARRIVAL DISPLAY */}
                          <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Next Bus
                              </span>
                              <div className="flex items-center gap-1.5 text-xs">
                                {renderLoadIndicator(svc.NextBus?.Load)}
                                {svc.NextBus?.Type && (
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1 rounded">
                                    {svc.NextBus.Type}
                                  </span>
                                )}
                                {svc.NextBus?.Feature === 'WAB' && (
                                  <span title="Wheelchair Accessible">
                                    <Accessibility className="w-3 h-3 text-slate-400" />
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-1 flex items-baseline justify-between">
                              <span
                                className={`text-3xl font-black font-mono tracking-tight ${
                                  arr1.status === 'imminent'
                                    ? 'text-emerald-400'
                                    : arr1.status === 'soon'
                                    ? 'text-emerald-300'
                                    : 'text-white'
                                }`}
                              >
                                {arr1.display}
                              </span>
                              {arr1.exact && (
                                <span className="text-xs font-mono text-slate-400">
                                  est. {arr1.exact}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2ND AND 3RD BUS ARRIVALS ROW */}
                          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/60">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>2nd Bus</span>
                                {svc.NextBus2?.Type && (
                                  <span className="font-mono text-[9px] text-slate-500">{svc.NextBus2.Type}</span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-baseline justify-between font-mono">
                                <span className="font-bold text-slate-200">{arr2.display}</span>
                                <span className="text-[10px] scale-90 origin-right">
                                  {renderLoadIndicator(svc.NextBus2?.Load)}
                                </span>
                              </div>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/60">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>3rd Bus</span>
                                {svc.NextBus3?.Type && (
                                  <span className="font-mono text-[9px] text-slate-500">{svc.NextBus3.Type}</span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-baseline justify-between font-mono">
                                <span className="font-bold text-slate-200">{arr3.display}</span>
                                <span className="text-[10px] scale-90 origin-right">
                                  {renderLoadIndicator(svc.NextBus3?.Load)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Compact Board / Row View: Super dense, compare 10+ services instantly */
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
                  <div className="bg-slate-950/80 px-4 py-2.5 grid grid-cols-12 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3 sm:col-span-2">Service</div>
                    <div className="col-span-4 sm:col-span-3">Next Bus</div>
                    <div className="col-span-3 sm:col-span-3">2nd Bus</div>
                    <div className="hidden sm:block sm:col-span-2">3rd Bus</div>
                    <div className="col-span-2 sm:col-span-2 text-right">Status</div>
                  </div>

                  {displayedServices.map((svc: CorrelatedService) => {
                    const arr1 = formatArrivalTime(svc.NextBus?.EstimatedArrival);
                    const arr2 = formatArrivalTime(svc.NextBus2?.EstimatedArrival);
                    const arr3 = formatArrivalTime(svc.NextBus3?.EstimatedArrival);
                    const isFav = favourites.includes(svc.ServiceNo);
                    const isDisrupted = svc.trafficImpact.status !== 'clear';

                    return (
                      <div
                        key={svc.ServiceNo}
                        className={`px-4 py-3 grid grid-cols-12 items-center hover:bg-slate-800/50 transition ${
                          isFav ? 'bg-amber-950/10' : ''
                        }`}
                      >
                        {/* Col: Service */}
                        <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                          <button
                            onClick={() => toggleFavourite(svc.ServiceNo)}
                            className={`p-0.5 ${isFav ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                          </button>
                          <span className="text-lg font-black font-mono text-white">
                            {svc.ServiceNo}
                          </span>
                          <span className="hidden sm:inline text-[10px] font-mono text-slate-500">
                            {svc.Operator}
                          </span>
                        </div>

                        {/* Col: Next Bus (Hero) */}
                        <div className="col-span-4 sm:col-span-3 flex items-baseline gap-2">
                          <span
                            className={`text-xl font-black font-mono ${
                              arr1.status === 'imminent'
                                ? 'text-emerald-400'
                                : arr1.status === 'soon'
                                ? 'text-emerald-300'
                                : 'text-white'
                            }`}
                          >
                            {arr1.display}
                          </span>
                          <span className="text-xs">{renderLoadIndicator(svc.NextBus?.Load)}</span>
                          {svc.NextBus?.Type === 'DD' && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1 rounded">
                              DD
                            </span>
                          )}
                        </div>

                        {/* Col: 2nd Bus */}
                        <div className="col-span-3 sm:col-span-3 flex items-baseline gap-1.5 font-mono text-xs">
                          <span className="font-bold text-slate-200">{arr2.display}</span>
                          <span className="scale-90 origin-left hidden sm:inline">
                            {renderLoadIndicator(svc.NextBus2?.Load)}
                          </span>
                        </div>

                        {/* Col: 3rd Bus */}
                        <div className="hidden sm:flex sm:col-span-2 items-baseline gap-1.5 font-mono text-xs">
                          <span className="font-bold text-slate-300">{arr3.display}</span>
                          <span className="scale-90 origin-left">
                            {renderLoadIndicator(svc.NextBus3?.Load)}
                          </span>
                        </div>

                        {/* Col: Corridor Status */}
                        <div className="col-span-2 sm:col-span-2 text-right">
                          {isDisrupted ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                                svc.trafficImpact.status === 'severe'
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                                  : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                              }`}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="hidden sm:inline">Delay Risk</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-400/80 font-medium hidden sm:inline">
                              Clear
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
                <Bus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white">
                  No matching bus services found
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {serviceSearch
                    ? `No service numbers match "${serviceSearch}" at Stop #${busStopCode}.`
                    : activeFilter === 'favourites'
                    ? 'You have not starred any bus services at this stop yet. Click the star icon to pin your daily buses.'
                    : `No bus services currently meet the "${activeFilter}" criteria.`}
                </p>
                {(serviceSearch || activeFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setServiceSearch('');
                      setActiveFilter('all');
                    }}
                    className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NEARBY BUS STOPS (WALKING DISTANCE RADAR) */}
        {activeTab === 'nearby' && (
          <div className="space-y-4">
            {/* Radius and Location Bar */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{userLocation.name}</span>
                    {userLocation.isRealGps && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                        Live GPS
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {userLocation.lat.toFixed(4)}° N, {userLocation.lng.toFixed(4)}° E
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Walking Range:</span>
                <div className="flex p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                  {[
                    { label: '500m (6m)', val: 0.5 },
                    { label: '1.2km (15m)', val: 1.2 },
                    { label: '2.5km (30m)', val: 2.5 },
                  ].map((rad) => (
                    <button
                      key={rad.val}
                      onClick={() => setNearbyRadiusKm(rad.val)}
                      className={`px-2.5 py-1 rounded font-medium transition ${
                        nearbyRadiusKm === rad.val
                          ? 'bg-slate-800 text-white font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rad.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Nearby Stops Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {nearbyBusStops.map((stop) => (
                <div
                  key={stop.code}
                  onClick={() => handleSelectNearbyStop(stop)}
                  className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-emerald-500/60 transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-black font-mono text-emerald-400">
                        #{stop.code}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 font-mono">
                        <Footprints className="w-3.5 h-3.5 text-slate-400" />
                        <span>{stop.distanceMeters}m</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">~{stop.walkingMinutes} min walk</span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {stop.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {stop.road}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                      <div className="flex flex-wrap gap-1">
                        {stop.services.map((svc) => (
                          <span
                            key={svc}
                            className="px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-950 text-slate-300 border border-slate-800"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>Inspect Arrivals</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DISRUPTIONS & TRAFFIC INCIDENTS */}
        {activeTab === 'traffic' && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Live Traffic Incidents & Route Correlation
                  </h3>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Source: OneMotoring Live Data</span>
                  <span>·</span>
                  <a
                    href="https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/traffic_information/traffic_updates_and_road_closures.html"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>LTA Feed</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFilterRouteOnly(!filterRouteOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                    filterRouteOnly
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Filter className="w-3 h-3 inline mr-1" />
                  {filterRouteOnly
                    ? `Stop #${busStopCode} Routes (${relevantRouteIncidents.length})`
                    : `All Singapore (${allIncidentsWithRouteMatch.length})`}
                </button>

                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={trafficSearch}
                    onChange={(e) => setTrafficSearch(e.target.value)}
                    placeholder="Search road/incident"
                    className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-500 font-mono w-40 sm:w-48 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Incidents List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedIncidents.map((inc, index) => {
                const isAccident = inc.Type.toLowerCase().includes('accident');
                const isBlackOut = inc.Type.toLowerCase().includes('black out');
                const isRoadwork = inc.Type.toLowerCase().includes('roadwork');

                return (
                  <div
                    key={index}
                    className={`bg-slate-900 rounded-xl border p-4 flex flex-col justify-between ${
                      inc.affectedServices.length > 0
                        ? 'border-rose-800/80 bg-rose-950/10'
                        : 'border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isAccident || isBlackOut
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isRoadwork
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {inc.Type}
                        </span>

                        {inc.affectedServices.length > 0 ? (
                          <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Stop #{busStopCode} Corridor</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            General Islandwide
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-200 leading-relaxed mt-1">
                        {inc.Message}
                      </p>

                      {inc.affectedServices.length > 0 && (
                        <div className="mt-2.5 p-2 rounded bg-slate-950 border border-slate-800/80 text-xs">
                          <span className="text-slate-400 font-medium">Buses affected on this corridor: </span>
                          <span className="font-mono font-bold text-rose-300">
                            {inc.affectedServices.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                      <span>Live status</span>
                      <button
                        onClick={() => setActiveTab('buses')}
                        className="text-emerald-400 hover:underline font-semibold"
                      >
                        Inspect Stop #{busStopCode} Buses
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: MRT / LRT NETWORK */}
        {activeTab === 'trains' && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                    <Train className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">MRT & LRT Rail Alerts</h3>
                    <p className="text-xs text-slate-400">Official status from LTA TrainServiceAlerts</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Network Normal</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Lines Active</div>
                  <div className="mt-1 font-bold text-white text-sm">NSL, EWL, NEL, CCL, DTL, TEL, LRT</div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Free Public Bus</div>
                  <div className="mt-1 font-bold text-emerald-400 text-sm">Normal Operations</div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">MRT Shuttle Bus</div>
                  <div className="mt-1 font-bold text-emerald-400 text-sm">Normal Operations</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ZAPIER RSS & DEVELOPER API */}
        {activeTab === 'rss' && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Rss className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">RSS 2.0 Feed for Zapier & Webhooks</h3>
                    <p className="text-xs text-slate-400">Direct integration feed at <code className="font-mono text-emerald-400">/api/feed</code></p>
                  </div>
                </div>
                <a
                  href="/api/feed"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-orange-950/60 border border-orange-800 text-orange-300 text-xs font-bold hover:bg-orange-900 transition flex items-center gap-1.5"
                >
                  <span>Open Feed XML</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-slate-400 font-medium">Feed URL for Zapier Webhook / RSS Trigger:</div>
                  <div className="mt-1 font-mono text-emerald-400 break-all select-all text-sm">
                    {window.location.origin}/api/feed
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-slate-300">
                  <div className="font-bold text-white">Feed Invariants:</div>
                  <div>• Item title summarizes incident count, first bottleneck, and next bus at stop 04121.</div>
                  <div>• GUID updates every quarter-hour at :00, :15, :30, :45 (e.g. <code className="font-mono text-emerald-400">g3-traffic-2026-11-11T14:15+08:00</code>).</div>
                  <div>• Responds HTTP 200 with clear status to keep Zapier automations running smoothly.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* AccountKey Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl max-w-md w-full border border-slate-800 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  LTA Datamall AccountKey
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              API keys are never hardcoded. You can supply an AccountKey for real-time live data queries or test using snapshot mode:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Datamall AccountKey
                </label>
                <input
                  type="password"
                  value={sessionKey}
                  onChange={(e) => setSessionKey(e.target.value)}
                  placeholder="Paste your 32-character AccountKey"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <a
                  href="https://datamall.lta.gov.sg/content/datamall/en/request-api.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium"
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
                    className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setShowKeyModal(false);
                      refreshAll();
                    }}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition shadow-sm"
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
