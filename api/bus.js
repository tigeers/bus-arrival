const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';

/**
 * Resolves the LTA Datamall AccountKey from process.env.
 * Never exposes or writes keys.
 */
export function getLtaAccountKey(req) {
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
 * Fetches Bus Arrival v3 live data for a specific BusStopCode.
 */
export async function fetchBusArrival(busStopCode = '83139', serviceNo, accountKey) {
  const key = accountKey || getLtaAccountKey();
  if (!key) {
    const err = new Error('MISSING_API_KEY');
    err.source = 'LTA BusArrival';
    err.status = 'missing key';
    throw err;
  }

  const cleanBusStopCode = encodeURIComponent(String(busStopCode).trim());
  let url = `${LTA_BASE_URL}/v3/BusArrival?BusStopCode=${cleanBusStopCode}`;
  if (serviceNo && String(serviceNo).trim()) {
    url += `&ServiceNo=${encodeURIComponent(String(serviceNo).trim())}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      AccountKey: key,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = new Error(`LTA BusArrival returned status ${response.status}`);
    err.source = 'LTA BusArrival';
    err.status = response.status;
    err.statusText = response.statusText;
    throw err;
  }

  return await response.json();
}

/**
 * Fetches current Traffic Incidents.
 */
export async function fetchTrafficIncidents(accountKey) {
  const key = accountKey || getLtaAccountKey();
  if (!key) {
    const err = new Error('MISSING_API_KEY');
    err.source = 'LTA TrafficIncidents';
    err.status = 'missing key';
    throw err;
  }

  const url = `${LTA_BASE_URL}/TrafficIncidents`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      AccountKey: key,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = new Error(`LTA TrafficIncidents returned status ${response.status}`);
    err.source = 'LTA TrafficIncidents';
    err.status = response.status;
    err.statusText = response.statusText;
    throw err;
  }

  return await response.json();
}

/**
 * Fetches MRT / LRT Train Service Alerts.
 */
export async function fetchTrainServiceAlerts(accountKey) {
  const key = accountKey || getLtaAccountKey();
  if (!key) {
    const err = new Error('MISSING_API_KEY');
    err.source = 'LTA TrainServiceAlerts';
    err.status = 'missing key';
    throw err;
  }

  const url = `${LTA_BASE_URL}/TrainServiceAlerts`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      AccountKey: key,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const err = new Error(`LTA TrainServiceAlerts returned status ${response.status}`);
    err.source = 'LTA TrainServiceAlerts';
    err.status = response.status;
    err.statusText = response.statusText;
    throw err;
  }

  return await response.json();
}

export default {
  getLtaAccountKey,
  fetchBusArrival,
  fetchTrafficIncidents,
  fetchTrainServiceAlerts,
};
