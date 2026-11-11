import { fetchBusArrival, fetchTrafficIncidents, getLtaAccountKey } from './bus.js';

/**
 * Escape XML special characters: &, <, >, ", '
 */
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Computes Singapore time (UTC+8) and rounds DOWN to the nearest quarter hour (:00, :15, :30, :45).
 */
function getSingaporeTimeMeta(date = new Date()) {
  const utcMs = date.getTime();
  const sgtMs = utcMs + 8 * 60 * 60 * 1000;
  const sgtDate = new Date(sgtMs);

  const year = sgtDate.getUTCFullYear();
  const month = String(sgtDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(sgtDate.getUTCDate()).padStart(2, '0');
  const hour = String(sgtDate.getUTCHours()).padStart(2, '0');
  const rawMin = sgtDate.getUTCMinutes();
  const rawSec = sgtDate.getUTCSeconds();
  const roundedMin = String(Math.floor(rawMin / 15) * 15).padStart(2, '0');

  // GUID & link query format: YYYY-MM-DDTHH:MM+08:00
  const timeString = `${year}-${month}-${day}T${hour}:${roundedMin}+08:00`;
  const guid = `g3-traffic-${timeString}`;

  // RFC 822 format: e.g. "Wed, 11 Nov 2026 14:15:00 +0800"
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[sgtDate.getUTCDay()];
  const monthName = months[sgtDate.getUTCMonth()];
  const pubDate = `${dayName}, ${day} ${monthName} ${year} ${hour}:${roundedMin}:00 +0800`;
  const lastBuildDate = `${dayName}, ${day} ${monthName} ${year} ${hour}:${String(rawMin).padStart(2, '0')}:${String(rawSec).padStart(2, '0')} +0800`;

  // Exact reading time in Singapore time
  const readingTimeText = `${day} ${monthName} ${year} ${hour}:${String(rawMin).padStart(2, '0')}:${String(rawSec).padStart(2, '0')} +08:00 (SGT)`;

  return {
    timeString,
    guid,
    pubDate,
    lastBuildDate,
    readingTimeText,
  };
}

/**
 * Extracts expressway / road name from an incident message.
 */
function extractRoadFromMessage(type, message) {
  if (!message) return type;
  // Match "on <Road Name> (towards" or "on <Road Name> before/after/between/at/near"
  const onMatch = message.match(/\bon\s+([A-Za-z0-9\s/]+?)(?=\s+\(towards|\s+before|\s+after|\s+between|\s+at\b|\s+near|\.|\,|$)/i);
  if (onMatch && onMatch[1] && onMatch[1].trim()) {
    const road = onMatch[1].trim();
    return `${type} on ${road}`;
  }
  // Check common expressways
  const expMatch = message.match(/\b(PIE|ECP|CTE|AYE|SLE|KPE|BKE|TPE|MCE)\b/i);
  if (expMatch) {
    return `${type} on ${expMatch[1].toUpperCase()}`;
  }
  return type;
}

/**
 * Formats arrival time string into local time in SGT (e.g. "2:45 PM").
 */
function formatArrivalTimeSgt(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const sgtMs = d.getTime() + 8 * 60 * 60 * 1000;
  const sgtDate = new Date(sgtMs);
  let h = sgtDate.getUTCHours();
  const m = String(sgtDate.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Builds the complete RSS 2.0 XML string.
 */
function renderRssFeed({ siteUrl, timeMeta, title, description }) {
  const itemLink = `${siteUrl}/?reading=${timeMeta.timeString}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Singapore Transport Live Reading</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Live reading of LTA Datamall traffic incidents and bus arrivals at stop 04121</description>
    <lastBuildDate>${escapeXml(timeMeta.lastBuildDate)}</lastBuildDate>
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(itemLink)}</link>
      <description>${escapeXml(description)}</description>
      <guid isPermaLink="false">${escapeXml(timeMeta.guid)}</guid>
      <pubDate>${escapeXml(timeMeta.pubDate)}</pubDate>
    </item>
  </channel>
</rss>`;
}

/**
 * GET /api/feed handler
 */
export default async function handler(req, res) {
  // Build site address from Host header without fetching itself
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const siteUrl = `${proto}://${host}`;

  const timeMeta = getSingaporeTimeMeta();

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

  const apiKey = getLtaAccountKey(req);
  if (!apiKey) {
    const xml = renderRssFeed({
      siteUrl,
      timeMeta,
      title: 'Check failed: LTA Datamall missing API key',
      description: `LTA Datamall AccountKey is missing. Please set LTA_DATAMALL_KEY in the server environment.\nReading time: ${timeMeta.readingTimeText}`,
    });
    return res.status(200).send(xml);
  }

  try {
    const [trafficResult, busResult] = await Promise.allSettled([
      fetchTrafficIncidents(apiKey),
      fetchBusArrival('04121', undefined, apiKey),
    ]);

    // Check for source failure: TrafficIncidents
    if (trafficResult.status === 'rejected') {
      const err = trafficResult.reason || {};
      const status = err.status || '502';
      const source = err.source || 'LTA TrafficIncidents';
      const xml = renderRssFeed({
        siteUrl,
        timeMeta,
        title: `Check failed: ${source} ${status}`,
        description: `Failed to fetch traffic incidents from LTA Datamall (${status}).\nReading time: ${timeMeta.readingTimeText}`,
      });
      return res.status(200).send(xml);
    }

    // Check for source failure: BusArrival
    if (busResult.status === 'rejected') {
      const err = busResult.reason || {};
      const status = err.status || '502';
      const source = err.source || 'LTA BusArrival';
      const xml = renderRssFeed({
        siteUrl,
        timeMeta,
        title: `Check failed: ${source} ${status}`,
        description: `Failed to fetch bus arrival data for stop 04121 from LTA Datamall (${status}).\nReading time: ${timeMeta.readingTimeText}`,
      });
      return res.status(200).send(xml);
    }

    const trafficData = trafficResult.value || {};
    const busData = busResult.value || {};
    const incidents = Array.isArray(trafficData.value) ? trafficData.value : [];
    const services = Array.isArray(busData.Services) ? busData.Services : [];

    // 1. Build Item Title:
    // Format: "3 incidents, Accident on PIE, bus 7 in 4 min"
    const incidentCount = incidents.length;
    const countText = `${incidentCount} incident${incidentCount === 1 ? '' : 's'}`;

    let incidentSummary = 'No active incidents';
    if (incidentCount > 0) {
      const first = incidents[0];
      incidentSummary = extractRoadFromMessage(first.Type || 'Incident', first.Message || '');
    }

    // Find the next upcoming bus across all services at stop 04121
    const nowMs = Date.now();
    let earliestService = null;
    let minDiffMinutes = Infinity;

    for (const svc of services) {
      if (svc.NextBus && svc.NextBus.EstimatedArrival) {
        const arrMs = new Date(svc.NextBus.EstimatedArrival).getTime();
        const diffMins = Math.round((arrMs - nowMs) / 60000);
        if (diffMins < minDiffMinutes && diffMins >= -2) {
          minDiffMinutes = diffMins;
          earliestService = {
            serviceNo: svc.ServiceNo,
            diffMins: Math.max(0, diffMins),
          };
        }
      }
    }

    let busSummary = 'no buses arriving';
    if (earliestService) {
      busSummary = `bus ${earliestService.serviceNo} in ${earliestService.diffMins} min`;
    }

    const itemTitle = `${countText}, ${incidentSummary}, ${busSummary}`;

    // 2. Build Item Description (Plain text, no HTML tags):
    // "Every incident with its type and LTA's message, then the next two buses for every service at stop 04121, then the time of the reading in Singapore time."
    const descLines = [];

    descLines.push(`TRAFFIC INCIDENTS (${incidentCount}):`);
    if (incidentCount === 0) {
      descLines.push('No active traffic incidents reported.');
    } else {
      incidents.forEach((inc, idx) => {
        descLines.push(`${idx + 1}. [${inc.Type || 'Incident'}] ${inc.Message || 'No message'}`);
      });
    }

    descLines.push('');
    descLines.push('NEXT BUSES AT STOP 04121:');
    if (services.length === 0) {
      descLines.push('No active bus services reported at this stop.');
    } else {
      services.forEach((svc) => {
        let bus1Str = 'Next bus: N/A';
        if (svc.NextBus && svc.NextBus.EstimatedArrival) {
          const m1 = Math.max(0, Math.round((new Date(svc.NextBus.EstimatedArrival).getTime() - nowMs) / 60000));
          const t1 = formatArrivalTimeSgt(svc.NextBus.EstimatedArrival);
          bus1Str = `Next bus in ${m1} min (${t1})`;
        }

        let bus2Str = '2nd bus: N/A';
        if (svc.NextBus2 && svc.NextBus2.EstimatedArrival) {
          const m2 = Math.max(0, Math.round((new Date(svc.NextBus2.EstimatedArrival).getTime() - nowMs) / 60000));
          const t2 = formatArrivalTimeSgt(svc.NextBus2.EstimatedArrival);
          bus2Str = `2nd bus in ${m2} min (${t2})`;
        }

        descLines.push(`Service ${svc.ServiceNo}: ${bus1Str}, ${bus2Str}`);
      });
    }

    descLines.push('');
    descLines.push(`Reading time: ${timeMeta.readingTimeText}`);

    const itemDescription = descLines.join('\n');

    const xml = renderRssFeed({
      siteUrl,
      timeMeta,
      title: itemTitle,
      description: itemDescription,
    });

    return res.status(200).send(xml);
  } catch (err) {
    const errorStatus = err.status || 'error';
    const errorSource = err.source || 'LTA Datamall';
    const xml = renderRssFeed({
      siteUrl,
      timeMeta,
      title: `Check failed: ${errorSource} ${errorStatus}`,
      description: `Failure reading LTA Datamall: ${err.message || 'unknown error'}\nReading time: ${timeMeta.readingTimeText}`,
    });
    return res.status(200).send(xml);
  }
}

export {
  getSingaporeTimeMeta,
  renderRssFeed,
  extractRoadFromMessage,
  formatArrivalTimeSgt,
};
