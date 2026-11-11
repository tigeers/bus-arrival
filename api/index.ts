import express from 'express';
import healthHandler, { getHealthStatus } from './health.ts';
import busTrackerHandler, {
  fetchBusArrival,
  fetchTrafficIncidents,
  fetchTrainServiceAlerts,
  getLtaAccountKey,
} from './bustracker.ts';

export * from './health.ts';
export * from './bustracker.ts';

export const apiRouter = express.Router();

// Mount /api/health
apiRouter.all('/health', (req, res) => {
  return healthHandler(req, res);
});

// Mount /api/bustracker and specific subpaths
apiRouter.all('/bustracker', (req, res) => {
  return busTrackerHandler(req, res);
});

apiRouter.all('/bustracker/arrival', (req, res) => {
  req.query.endpoint = 'BusArrival';
  return busTrackerHandler(req, res);
});

apiRouter.all('/bustracker/traffic', (req, res) => {
  req.query.endpoint = 'TrafficIncidents';
  return busTrackerHandler(req, res);
});

apiRouter.all('/bustracker/trains', (req, res) => {
  req.query.endpoint = 'TrainServiceAlerts';
  return busTrackerHandler(req, res);
});

apiRouter.all('/bustracker/correlate', (req, res) => {
  req.query.endpoint = 'correlate';
  return busTrackerHandler(req, res);
});

export default apiRouter;
