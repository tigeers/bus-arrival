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
 * - endpoint: "BusArrival" | "TrafficIncidents" | "TrainServiceAlerts" | "all"
 * - BusStopCode: string (e.g. "83139", default)
 * - ServiceNo: optional string (e.g. "15")
 */
export default async function handler(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');

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

  const endpoint = (
    (req.query.endpoint as string) ||
    (req.query.type as string) ||
    (req.path.includes('traffic') ? 'traffic' : req.path.includes('train') ? 'train' : req.path.includes('arrival') ? 'arrival' : 'BusArrival')
  ).toLowerCase();

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

    if (endpoint === 'all') {
      const [busArrival, traffic, trainAlerts] = await Promise.allSettled([
        fetchBusArrival(busStopCode, serviceNo, accountKey),
        fetchTrafficIncidents(accountKey),
        fetchTrainServiceAlerts(accountKey),
      ]);

      return res.status(200).json({
        success: true,
        endpoint: 'all',
        timestamp: new Date().toISOString(),
        busStopCode,
        data: {
          busArrival: busArrival.status === 'fulfilled' ? busArrival.value : { error: busArrival.reason?.message },
          trafficIncidents: traffic.status === 'fulfilled' ? traffic.value : { error: traffic.reason?.message },
          trainServiceAlerts: trainAlerts.status === 'fulfilled' ? trainAlerts.value : { error: trainAlerts.reason?.message },
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
