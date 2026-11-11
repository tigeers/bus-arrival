import type { Request, Response } from 'express';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  datamall: {
    isKeyConfigured: boolean;
    keySource: 'environment' | 'request_header' | 'none';
    endpoints: {
      busArrival: string;
      trafficIncidents: string;
      trainServiceAlerts: string;
    };
  };
  endpoints: {
    bustracker: string;
    health: string;
  };
}

export function getHealthStatus(req?: Request): HealthStatus {
  const envKey = process.env.LTA_DATAMALL_KEY || process.env.LTA_API_KEY || process.env.ACCOUNT_KEY;
  const headerKey = req ? (req.headers['accountkey'] || req.headers['x-account-key']) : undefined;

  const isKeyConfigured = Boolean(envKey || headerKey);
  const keySource = envKey ? 'environment' : headerKey ? 'request_header' : 'none';

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    datamall: {
      isKeyConfigured,
      keySource,
      endpoints: {
        busArrival: 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=83139',
        trafficIncidents: 'https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents',
        trainServiceAlerts: 'https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts',
      },
    },
    endpoints: {
      bustracker: '/api/bustracker',
      health: '/api/health',
    },
  };
}

/**
 * Serverless / Express handler for /api/health
 */
export default async function handler(req: Request, res: Response) {
  try {
    const health = getHealthStatus(req);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(health);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
}
