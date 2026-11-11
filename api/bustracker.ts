import type { Request, Response } from 'express';

export interface NextBus {
  OriginCode?: string;
  DestinationCode?: string;
  EstimatedArrival?: string;
  Latitude?: string;
  Longitude?: string;
  VisitNumber?: string;
  Load?: 'SEA' | 'SDA' | 'LSD' | string; // Seats Available, Standing Available, Limited Standing
  Feature?: 'WAB' | string; // Wheelchair Accessible Bus
  Type?: 'SD' | 'DD' | 'BD' | string; // Single Deck, Double Deck, Bendy
}

export interface BusService {
  ServiceNo: string;
  Operator: string;
  NextBus?: NextBus;
  NextBus2?: NextBus;
  NextBus3?: NextBus;
}

export interface BusArrivalData {
  'odata.metadata'?: string;
  BusStopCode: string;
  Services: BusService[];
}

export interface TrafficIncident {
  Type: string;
  Latitude: number;
  Longitude: number;
  Message: string;
}

export interface TrafficIncidentsData {
  'odata.metadata'?: string;
  value: TrafficIncident[];
}

export interface TrainAlertMessage {
  Content?: string;
  CreatedDate?: string;
}

export interface TrainAlertValue {
  Status?: number; // 1 = Normal, 2 = Disrupted
  Line?: string;
  Direction?: string;
  Stations?: string;
  FreePublicBus?: string;
  FreeMRTShuttle?: string;
  Message?: TrainAlertMessage[] | null;
}

export interface TrainServiceAlertsData {
  'odata.metadata'?: string;
  value: TrainAlertValue | TrainAlertValue[];
}

export interface CorrelatedIncidentImpact {
  incident: TrafficIncident;
  distanceKm: number;
  severity: 'high' | 'medium' | 'low';
  target: 'bus_stop' | 'next_bus' | 'next_bus_2' | 'next_bus_3';
  summary: string;
}

export interface EnrichedBusService extends BusService {
  trafficImpact: {
    status: 'clear' | 'minor' | 'moderate' | 'severe';
    delayRiskText?: string;
    closestDistanceKm?: number;
    impactedBy: CorrelatedIncidentImpact[];
  };
}

export interface CorrelatedBusArrivalData {
  BusStopCode: string;
  stopName?: string;
  stopCoordinates?: { lat: number; lng: number };
  corridorStatus: 'clear' | 'minor' | 'moderate' | 'severe';
  corridorSummary: string;
  nearbyIncidentsCount: number;
  stopIncidents: CorrelatedIncidentImpact[];
  Services: EnrichedBusService[];
  timestamp: string;
}

export interface BusStopInfo {
  code: string;
  name: string;
  road: string;
  lat: number;
  lng: number;
  services: string[];
  neighborhood: string;
}

export const KNOWN_BUS_STOPS: Record<string, BusStopInfo> = {
  '83139': { code: '83139', lat: 1.30155, lng: 103.90538, name: 'Opp Parkway Parade', road: 'Marine Parade Rd', neighborhood: 'Marine Parade', services: ['15', '31', '36', '43', '48', '134', '135', '196', '197'] },
  '83149': { code: '83149', lat: 1.30230, lng: 103.90480, name: 'Parkway Parade', road: 'Marine Parade Rd', neighborhood: 'Marine Parade', services: ['15', '31', '36', '43', '48', '134', '135', '196', '197'] },
  '09048': { code: '09048', lat: 1.30403, lng: 103.83307, name: 'Orchard Stn / Lucky Plaza', road: 'Orchard Rd', neighborhood: 'Orchard', services: ['7', '14', '16', '65', '106', '111', '123', '175', '502'] },
  '09038': { code: '09038', lat: 1.30250, lng: 103.83680, name: 'Opp Mandarin Orchard', road: 'Orchard Rd', neighborhood: 'Orchard', services: ['36', '77', '124', '143', '167', '174', '190'] },
  '04121': { code: '04121', lat: 1.28549, lng: 103.84968, name: 'OCBC Ctr / Raffles Pl', road: 'Chulia St', neighborhood: 'Downtown / CBD', services: ['186'] },
  '03019': { code: '03019', lat: 1.28620, lng: 103.85310, name: 'Fullerton Sq', road: 'Fullerton Rd', neighborhood: 'Downtown / Marina', services: ['10', '57', '70', '75', '100', '107', '130', '131', '167', '196'] },
  '02049': { code: '02049', lat: 1.29490, lng: 103.85400, name: 'Raffles Hotel', road: 'Bras Basah Rd', neighborhood: 'City Hall', services: ['14', '16', '36', '77', '106', '111', '130', '131', '133', '167', '857'] },
  '01012': { code: '01012', lat: 1.29815, lng: 103.84988, name: 'Hotel Rendezvous', road: 'Bras Basah Rd', neighborhood: 'Bras Basah', services: ['7', '14', '16', '36', '111', '131', '162', '167', '175'] },
  '65009': { code: '65009', lat: 1.35334, lng: 103.94523, name: 'Tampines Stn / Int', road: 'Tampines Ave 4', neighborhood: 'Tampines', services: ['3', '4', '10', '19', '20', '23', '28', '29', '31', '37', '38', '65', '67'] },
  '65141': { code: '65141', lat: 1.35410, lng: 103.94380, name: 'Opp Tampines Stn', road: 'Tampines Ave 4', neighborhood: 'Tampines', services: ['15', '21', '27', '168'] },
  '10009': { code: '10009', lat: 1.26477, lng: 103.82236, name: 'Opp VivoCity', road: 'Telok Blangah Rd', neighborhood: 'HarbourFront', services: ['10', '30', '57', '61', '97', '100', '131', '143', '145', '166'] },
  '14141': { code: '14141', lat: 1.26380, lng: 103.82190, name: 'VivoCity', road: 'HarbourFront Walk', neighborhood: 'HarbourFront', services: ['10', '30', '61', '97', '100', '131', '143', '166', '188'] },
  '28009': { code: '28009', lat: 1.33315, lng: 103.74229, name: 'Jurong East Bus Int', road: 'Jurong Gateway Rd', neighborhood: 'Jurong East', services: ['51', '52', '66', '78', '79', '97', '98', '105', '143', '183', '197', '333', '334', '335'] },
  '17179': { code: '17179', lat: 1.31550, lng: 103.76520, name: 'Clementi Stn Exit A', road: 'Commonwealth Ave West', neighborhood: 'Clementi', services: ['14', '52', '96', '105', '106', '147', '154', '165', '166', '196'] },
  '11119': { code: '11119', lat: 1.29420, lng: 103.80620, name: 'Bef Queenstown Stn', road: 'Commonwealth Ave', neighborhood: 'Queenstown', services: ['51', '111', '145', '186', '195', '970'] },
  '52009': { code: '52009', lat: 1.35084, lng: 103.84814, name: 'Bishan Stn', road: 'Bishan Rd', neighborhood: 'Bishan', services: ['50', '52', '53', '54', '55', '56', '57', '58', '59', '410'] },
  '54009': { code: '54009', lat: 1.36950, lng: 103.84850, name: 'Ang Mo Kio Int', road: 'AMK Ave 8', neighborhood: 'Ang Mo Kio', services: ['22', '24', '25', '73', '76', '86', '130', '132', '133', '135', '136', '138', '166'] },
  '70019': { code: '70019', lat: 1.32402, lng: 103.92984, name: 'Bedok Stn Exit B', road: 'New Upper Changi Rd', neighborhood: 'Bedok', services: ['2', '9', '24', '28', '31', '35', '67', '222'] },
  '46009': { code: '46009', lat: 1.43680, lng: 103.78650, name: 'Woodlands Temp Int', road: 'Woodlands Sq', neighborhood: 'Woodlands', services: ['161', '168', '169', '178', '187', '856', '900', '901', '903', '911', '912', '913', '925'] },
  '59009': { code: '59009', lat: 1.42940, lng: 103.83510, name: 'Yishun Int', road: 'Yishun Ave 2', neighborhood: 'Yishun', services: ['39', '85', '103', '171', '800', '804', '806', '811', '812', '851', '852', '854', '855', '857'] },
  '03218': { code: '03218', lat: 1.29120, lng: 103.85040, name: 'Opp The Treasury', road: 'North Bridge Rd', neighborhood: 'City Hall', services: ['32', '51', '61', '63', '80', '124', '145', '166', '174', '197'] },
  '21009': { code: '21009', lat: 1.33920, lng: 103.70560, name: 'Boon Lay Int', road: 'Jurong West Central 3', neighborhood: 'Jurong West', services: ['30', '79', '154', '157', '174', '179', '181', '192', '193', '194', '198', '240', '241'] }
};

export interface NearbyBusStopResult extends BusStopInfo {
  distanceKm: number;
  distanceMeters: number;
  walkingMinutes: number;
}

/**
 * Finds bus stops near a given coordinate, sorted by distance.
 */
export function findNearbyBusStops(lat: number, lng: number, maxDistanceKm: number = 3.0): NearbyBusStopResult[] {
  const results: NearbyBusStopResult[] = [];
  for (const stop of Object.values(KNOWN_BUS_STOPS)) {
    const distKm = calculateDistanceKm(lat, lng, stop.lat, stop.lng);
    if (distKm <= maxDistanceKm) {
      const distM = Math.round(distKm * 1000);
      const walkMin = Math.max(1, Math.round(distM / 80)); // 80m per min average walk
      results.push({
        ...stop,
        distanceKm: distKm,
        distanceMeters: distM,
        walkingMinutes: walkMin,
      });
    }
  }
  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Calculates geographic distance in kilometers using the Haversine formula.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Correlates live traffic incidents with bus arrival predictions based on geographic distance
 * and incident severity.
 */
export function correlateTrafficWithBusArrival(
  busArrival: BusArrivalData,
  trafficData: TrafficIncidentsData
): CorrelatedBusArrivalData {
  const incidents = trafficData.value || [];
  const knownStop = KNOWN_BUS_STOPS[busArrival.BusStopCode];
  const stopCoordinates = knownStop
    ? { lat: knownStop.lat, lng: knownStop.lng }
    : undefined;

  // Correlate incidents near the bus stop itself (within 3km)
  const stopIncidents: CorrelatedIncidentImpact[] = [];
  if (stopCoordinates) {
    for (const inc of incidents) {
      if (inc.Latitude && inc.Longitude) {
        const dist = calculateDistanceKm(stopCoordinates.lat, stopCoordinates.lng, inc.Latitude, inc.Longitude);
        if (dist <= 3.0) {
          const isHighSeverity = inc.Type.toLowerCase().includes('accident') || inc.Type.toLowerCase().includes('closure');
          const isMedSeverity = inc.Type.toLowerCase().includes('roadwork') || inc.Type.toLowerCase().includes('heavy traffic');
          const severity = (dist <= 1.2 && isHighSeverity) ? 'high' : (dist <= 2.0 && (isHighSeverity || isMedSeverity)) ? 'medium' : 'low';

          stopIncidents.push({
            incident: inc,
            distanceKm: dist,
            severity,
            target: 'bus_stop',
            summary: `${inc.Type} ~${dist}km from stop: ${inc.Message}`,
          });
        }
      }
    }
  }

  // Correlate each bus service and its live vehicles
  const enrichedServices: EnrichedBusService[] = (busArrival.Services || []).map((service) => {
    const impacts: CorrelatedIncidentImpact[] = [];

    // Check each approaching bus (NextBus, NextBus2, NextBus3)
    const checkBus = (bus: NextBus | undefined, target: 'next_bus' | 'next_bus_2' | 'next_bus_3') => {
      if (!bus || !bus.Latitude || !bus.Longitude) return;
      const bLat = parseFloat(bus.Latitude);
      const bLng = parseFloat(bus.Longitude);
      if (isNaN(bLat) || isNaN(bLng) || bLat <= 1.0 || bLng <= 100.0) return;

      for (const inc of incidents) {
        if (!inc.Latitude || !inc.Longitude) continue;
        const dist = calculateDistanceKm(bLat, bLng, inc.Latitude, inc.Longitude);
        if (dist <= 2.5) {
          const isHighSeverity = inc.Type.toLowerCase().includes('accident') || inc.Type.toLowerCase().includes('closure');
          const isMedSeverity = inc.Type.toLowerCase().includes('roadwork') || inc.Type.toLowerCase().includes('heavy traffic');
          const severity = (dist <= 0.8 && isHighSeverity) ? 'high' : (dist <= 1.8 && (isHighSeverity || isMedSeverity)) ? 'medium' : 'low';

          impacts.push({
            incident: inc,
            distanceKm: dist,
            severity,
            target,
            summary: `${inc.Type} ${dist}km from approaching bus: ${inc.Message}`,
          });
        }
      }
    };

    checkBus(service.NextBus, 'next_bus');
    checkBus(service.NextBus2, 'next_bus_2');
    checkBus(service.NextBus3, 'next_bus_3');

    // Combine with stop incidents that are within 1.5km
    for (const stopInc of stopIncidents) {
      if (stopInc.distanceKm <= 1.5 && !impacts.some((i) => i.incident.Message === stopInc.incident.Message)) {
        impacts.push(stopInc);
      }
    }

    // Sort by proximity
    impacts.sort((a, b) => a.distanceKm - b.distanceKm);

    // Determine status & delay risk
    let status: 'clear' | 'minor' | 'moderate' | 'severe' = 'clear';
    let delayRiskText: string | undefined = undefined;

    if (impacts.some((i) => i.severity === 'high')) {
      status = 'severe';
      const worst = impacts.find((i) => i.severity === 'high')!;
      delayRiskText = `High Delay Risk (+8-15 mins): ${worst.incident.Type} ~${worst.distanceKm}km away`;
    } else if (impacts.some((i) => i.severity === 'medium')) {
      status = 'moderate';
      const worst = impacts.find((i) => i.severity === 'medium')!;
      delayRiskText = `Moderate Delay Risk (+4-8 mins): ${worst.incident.Type} ~${worst.distanceKm}km away`;
    } else if (impacts.length > 0) {
      status = 'minor';
      delayRiskText = `Minor Alert: ${impacts[0].incident.Type} within ~${impacts[0].distanceKm}km`;
    }

    return {
      ...service,
      trafficImpact: {
        status,
        delayRiskText,
        closestDistanceKm: impacts[0]?.distanceKm,
        impactedBy: impacts,
      },
    };
  });

  // Calculate corridor overall summary
  const hasSevere = enrichedServices.some((s) => s.trafficImpact.status === 'severe') || stopIncidents.some((i) => i.severity === 'high');
  const hasModerate = enrichedServices.some((s) => s.trafficImpact.status === 'moderate') || stopIncidents.some((i) => i.severity === 'medium');
  const hasMinor = enrichedServices.some((s) => s.trafficImpact.status === 'minor') || stopIncidents.length > 0;

  const corridorStatus: 'clear' | 'minor' | 'moderate' | 'severe' = hasSevere
    ? 'severe'
    : hasModerate
    ? 'moderate'
    : hasMinor
    ? 'minor'
    : 'clear';

  const totalImpactsCount = stopIncidents.length;
  let corridorSummary = 'Corridor Clear: No traffic incidents detected within 3km of this stop or arriving buses.';
  if (corridorStatus === 'severe') {
    corridorSummary = `Severe Congestion Warning: Major incidents (accidents/closures) detected within route corridor. Arriving buses may experience 10-15+ min delays.`;
  } else if (corridorStatus === 'moderate') {
    corridorSummary = `Moderate Traffic Advisory: Roadworks or congestion detected within 2km corridor. Expect 4-8 min delays.`;
  } else if (corridorStatus === 'minor') {
    corridorSummary = `Minor Traffic Advisory: Incidents reported within 3km radius. Monitor arrival times.`;
  }

  return {
    BusStopCode: busArrival.BusStopCode,
    stopName: knownStop?.name,
    stopCoordinates,
    corridorStatus,
    corridorSummary,
    nearbyIncidentsCount: totalImpactsCount,
    stopIncidents,
    Services: enrichedServices,
    timestamp: new Date().toISOString(),
  };
}

const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';

/**
 * Resolves the LTA Datamall AccountKey from request headers or environment variables.
 * Keys are never hardcoded and must be provided via env or header.
 */
export function getLtaAccountKey(req?: Request): string | null {
  if (req) {
    const headerKey = req.headers['accountkey'] || req.headers['x-account-key'];
    if (typeof headerKey === 'string' && headerKey.trim().length > 0) {
      return headerKey.trim();
    }
    if (Array.isArray(headerKey) && headerKey[0]) {
      return headerKey[0].trim();
    }
    const queryKey = req.query?.apiKey || req.query?.accountKey;
    if (typeof queryKey === 'string' && queryKey.trim().length > 0) {
      return queryKey.trim();
    }
  }

  const envKey =
    process.env.LTA_DATAMALL_KEY ||
    process.env.LTA_API_KEY ||
    process.env.ACCOUNT_KEY ||
    process.env.VITE_LTA_DATAMALL_KEY;

  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return null;
}

/**
 * Fetches Bus Arrival v3 live data for a specific BusStopCode (default 83139).
 * URL: https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=83139
 */
export async function fetchBusArrival(
  busStopCode: string = '83139',
  serviceNo?: string,
  accountKey?: string
): Promise<BusArrivalData> {
  if (!accountKey) {
    throw new Error('MISSING_API_KEY: AccountKey header or LTA_DATAMALL_KEY environment variable is required.');
  }

  const cleanBusStopCode = encodeURIComponent(busStopCode.trim());
  let url = `${LTA_BASE_URL}/v3/BusArrival?BusStopCode=${cleanBusStopCode}`;
  if (serviceNo && serviceNo.trim()) {
    url += `&ServiceNo=${encodeURIComponent(serviceNo.trim())}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      AccountKey: accountKey,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LTA BusArrival API failed (${response.status} ${response.statusText}): ${errorBody || 'Check AccountKey permissions.'}`);
  }

  return (await response.json()) as BusArrivalData;
}

/**
 * Fetches current Traffic Incidents.
 * URL: https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents
 */
export async function fetchTrafficIncidents(accountKey?: string): Promise<TrafficIncidentsData> {
  if (!accountKey) {
    throw new Error('MISSING_API_KEY: AccountKey header or LTA_DATAMALL_KEY environment variable is required.');
  }

  const url = `${LTA_BASE_URL}/TrafficIncidents`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      AccountKey: accountKey,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LTA TrafficIncidents API failed (${response.status} ${response.statusText}): ${errorBody || 'Check AccountKey permissions.'}`);
  }

  return (await response.json()) as TrafficIncidentsData;
}

/**
 * Fetches MRT / LRT Train Service Alerts.
 * URL: https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts
 */
export async function fetchTrainServiceAlerts(accountKey?: string): Promise<TrainServiceAlertsData> {
  if (!accountKey) {
    throw new Error('MISSING_API_KEY: AccountKey header or LTA_DATAMALL_KEY environment variable is required.');
  }

  const url = `${LTA_BASE_URL}/TrainServiceAlerts`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      AccountKey: accountKey,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LTA TrainServiceAlerts API failed (${response.status} ${response.statusText}): ${errorBody || 'Check AccountKey permissions.'}`);
  }

  return (await response.json()) as TrainServiceAlertsData;
}

/**
 * Primary Serverless and Express Handler for /api/bustracker
 *
 * Supported query options:
 * - endpoint: "BusArrival" | "TrafficIncidents" | "TrainServiceAlerts" | "correlate" | "all"
 * - BusStopCode: string (e.g. "83139", default)
 * - ServiceNo: optional string (e.g. "15")
 */
export default async function handler(req: Request, res: Response) {
  const endpoint = (
    (req.query.endpoint as string) ||
    (req.query.type as string) ||
    (req.path.includes('nearby') ? 'nearby' : req.path.includes('correlat') ? 'correlate' : req.path.includes('traffic') ? 'traffic' : req.path.includes('train') ? 'train' : req.path.includes('arrival') ? 'arrival' : 'BusArrival')
  ).toLowerCase();

  // Nearby bus stops can be looked up from geographic coordinates directly
  if (endpoint === 'nearby') {
    const lat = parseFloat(req.query.lat as string) || 1.30155;
    const lng = parseFloat(req.query.lng as string) || 103.90538;
    const radius = parseFloat(req.query.radius as string) || 3.0;
    const stops = findNearbyBusStops(lat, lng, radius);
    return res.status(200).json({
      success: true,
      endpoint: 'nearby',
      center: { lat, lng },
      radiusKm: radius,
      count: stops.length,
      data: stops,
    });
  }

  const accountKey = getLtaAccountKey(req);
  if (!accountKey) {
    return res.status(401).json({
      error: 'MISSING_API_KEY',
      message:
        'LTA Datamall AccountKey is not set. Please set LTA_DATAMALL_KEY in your environment, or provide it via the "AccountKey" request header.',
      isKeyConfigured: false,
      endpointsRequested: {
        busArrival: `${LTA_BASE_URL}/v3/BusArrival?BusStopCode=83139`,
        trafficIncidents: `${LTA_BASE_URL}/TrafficIncidents`,
        trainServiceAlerts: `${LTA_BASE_URL}/TrainServiceAlerts`,
      },
      instructions:
        'Register for an AccountKey at https://datamall.lta.gov.sg/content/datamall/en/request-api.html, then set LTA_DATAMALL_KEY in your server environment or pass the AccountKey header.',
    });
  }

  const busStopCode = ((req.query.BusStopCode as string) || (req.query.busStopCode as string) || '83139').trim();
  const serviceNo = (req.query.ServiceNo as string) || (req.query.serviceNo as string) || undefined;

  try {
    if (endpoint === 'traffic' || endpoint === 'trafficincidents' || endpoint === 'traffic_incidents') {
      const data = await fetchTrafficIncidents(accountKey);
      return res.status(200).json({
        success: true,
        endpoint: 'TrafficIncidents',
        timestamp: new Date().toISOString(),
        data,
      });
    }

    if (endpoint === 'train' || endpoint === 'trains' || endpoint === 'trainservicealerts' || endpoint === 'train_alerts') {
      const data = await fetchTrainServiceAlerts(accountKey);
      return res.status(200).json({
        success: true,
        endpoint: 'TrainServiceAlerts',
        timestamp: new Date().toISOString(),
        data,
      });
    }

    // Correlate bus arrival with traffic incidents
    if (endpoint === 'correlate' || endpoint === 'correlated' || endpoint === 'correlation') {
      const [busArrival, traffic] = await Promise.all([
        fetchBusArrival(busStopCode, serviceNo, accountKey),
        fetchTrafficIncidents(accountKey),
      ]);

      const correlated = correlateTrafficWithBusArrival(busArrival, traffic);
      return res.status(200).json({
        success: true,
        endpoint: 'correlate',
        busStopCode,
        timestamp: new Date().toISOString(),
        data: correlated,
      });
    }

    if (endpoint === 'all') {
      const [busArrival, traffic, trainAlerts] = await Promise.allSettled([
        fetchBusArrival(busStopCode, serviceNo, accountKey),
        fetchTrafficIncidents(accountKey),
        fetchTrainServiceAlerts(accountKey),
      ]);

      const rawBus = busArrival.status === 'fulfilled' ? busArrival.value : null;
      const rawTraffic = traffic.status === 'fulfilled' ? traffic.value : null;

      let correlated: CorrelatedBusArrivalData | null = null;
      if (rawBus && rawTraffic) {
        correlated = correlateTrafficWithBusArrival(rawBus, rawTraffic);
      }

      return res.status(200).json({
        success: true,
        endpoint: 'all',
        timestamp: new Date().toISOString(),
        busStopCode,
        data: {
          busArrival: rawBus || { error: (busArrival as PromiseRejectedResult).reason?.message },
          trafficIncidents: rawTraffic || { error: (traffic as PromiseRejectedResult).reason?.message },
          trainServiceAlerts: trainAlerts.status === 'fulfilled' ? trainAlerts.value : { error: trainAlerts.reason?.message },
          correlated,
        },
      });
    }

    // Default: BusArrival v3
    const data = await fetchBusArrival(busStopCode, serviceNo, accountKey);
    return res.status(200).json({
      success: true,
      endpoint: 'BusArrival',
      busStopCode,
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during LTA Datamall request';
    return res.status(502).json({
      success: false,
      error: 'UPSTREAM_API_ERROR',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
