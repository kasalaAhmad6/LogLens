import fs from 'fs';
import readline from 'readline';
import path from 'path';
import geoip from 'geoip-lite';
import { fileURLToPath } from 'url';
import { insertLogsAndThreatsBatch, updateJobStatus } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read signatures
const signaturesPath = path.join(__dirname, 'signatures.json');
const signatures = JSON.parse(fs.readFileSync(signaturesPath, 'utf8'));

// Compile regex patterns for speed
const compiledSignatures = signatures.map(sig => ({
  ...sig,
  compiledPatterns: sig.patterns.map(p => new RegExp(p, 'i'))
}));

// Robust CLF / Nginx Log Regex that accounts for escaped double-quotes in request, referer, and user agent
// Captures: 1=IP, 2=Ident, 3=User, 4=Timestamp, 5=Request, 6=Status Code, 7=Response Size, 8=Referer, 9=User Agent
const logRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+\[([\w:/]+\s[+\-]\d{4})\]\s+"((?:[^"\\]|\\.)*)"\s+(\d{3})\s+(\S+)(?:\s+"((?:[^"\\]|\\.)*)"\s+"((?:[^"\\]|\\.)*)")?/;

const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
};

// Convert Apache timestamp "10/Oct/2000:13:55:36 -0700" to ISO string
function parseCLFTimestamp(clfTime) {
  try {
    const match = clfTime.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+\-]\d{4})$/);
    if (!match) return new Date().toISOString();
    
    const [_, day, monthStr, year, hour, minute, second, timezone] = match;
    const month = MONTHS[monthStr] || '01';
    const tzFormatted = timezone.slice(0, 3) + ':' + timezone.slice(3);
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${tzFormatted}`;
    return new Date(isoString).toISOString();
  } catch (err) {
    return new Date().toISOString();
  }
}

// Track brute force: Map IP -> array of timestamps of failed login attempts
// A failed login is defined by 401 (Unauthorized) or 403 (Forbidden) response codes.
const bruteForceTracker = new Map();
const BRUTE_FORCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes sliding window
const BRUTE_FORCE_THRESHOLD = 5; // Flags on >= 5 failed attempts in window

function checkBruteForce(ip, timestampStr, statusCode) {
  const code = parseInt(statusCode, 10);
  if (code !== 401 && code !== 403) return null;

  const currentMs = new Date(timestampStr).getTime();
  if (!bruteForceTracker.has(ip)) {
    bruteForceTracker.set(ip, []);
  }

  const attempts = bruteForceTracker.get(ip);
  attempts.push(currentMs);

  // Filter attempts outside the 5-minute sliding window
  const cutoff = currentMs - BRUTE_FORCE_WINDOW_MS;
  const activeAttempts = attempts.filter(t => t >= cutoff);
  bruteForceTracker.set(ip, activeAttempts);

  if (activeAttempts.length >= BRUTE_FORCE_THRESHOLD) {
    return {
      type: 'brute_force',
      severity: activeAttempts.length >= 10 ? 'high' : 'medium',
      matched_pattern: `Brute Force: ${activeAttempts.length} unauthorized requests (401/403) within 5 mins`
    };
  }

  return null;
}

// Safe synchronous decode helper
function safeDecodeURIComponent(str) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

// Scan request path and query string for signature matches
function detectSignatures(pathStr) {
  const matchedThreats = [];
  if (!pathStr) return matchedThreats;

  const decodedPath = safeDecodeURIComponent(pathStr);

  for (const sig of compiledSignatures) {
    for (const regex of sig.compiledPatterns) {
      if (regex.test(decodedPath)) {
        matchedThreats.push({
          type: sig.id,
          severity: sig.severity,
          matched_pattern: regex.toString()
        });
        break; // Stop testing other patterns for this signature type once we hit a match
      }
    }
  }
  return matchedThreats;
}

export async function parseLogFile(filePath, jobId) {
  let totalLines = 0;
  let parsedLines = 0;
  let attacksFound = 0;
  
  try {
    // Pass 1: Count lines (fast, memory-safe streaming)
    const countStream = fs.createReadStream(filePath);
    const rlCount = readline.createInterface({
      input: countStream,
      crlfDelay: Infinity
    });

    for await (const _ of rlCount) {
      totalLines++;
    }
    
    // Update status to processing
    updateJobStatus(jobId, 'processing', 0, 0, totalLines, 0);

    // Pass 2: Parse and process logs
    const readStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity
    });

    const BATCH_SIZE = 1000;
    let logsBatch = [];
    let threatsBatch = [];
    let tempIndexCounter = 0;
    let lastProgressUpdate = Date.now();

    for await (const line of rl) {
      parsedLines++;
      const match = line.match(logRegex);
      
      if (match) {
        const ip = match[1];
        const rawTime = match[4];
        const requestStr = match[5];
        const statusCode = match[6];
        const sizeStr = match[7];
        const userAgent = match[9] || '-';
        
        // Parse request string (split by whitespace)
        // Format: "METHOD PATH VERSION" e.g., "GET /index.html HTTP/1.1"
        const requestParts = requestStr.split(/\s+/);
        const method = requestParts[0] || '-';
        const requestPath = requestParts[1] || '-';

        const timestamp = parseCLFTimestamp(rawTime);
        const size = sizeStr === '-' ? 0 : parseInt(sizeStr, 10);

        // Geolocation Lookup (Offline database)
        let country = 'Unknown';
        if (ip !== '127.0.0.1' && ip !== '::1' && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
          const geo = geoip.lookup(ip);
          if (geo && geo.country) {
            country = geo.country;
          }
        } else {
          country = 'Local Network';
        }

        // Threat Detection
        const logThreats = detectSignatures(requestPath);
        
        // Brute force heuristic checks
        const bruteForceAlert = checkBruteForce(ip, timestamp, statusCode);
        if (bruteForceAlert) {
          logThreats.push(bruteForceAlert);
        }

        const tempIndex = tempIndexCounter++;
        logsBatch.push({
          tempIndex,
          job_id: jobId,
          ip,
          timestamp,
          method,
          path: requestPath,
          status_code: parseInt(statusCode, 10),
          size,
          user_agent: userAgent,
          country
        });

        for (const threat of logThreats) {
          attacksFound++;
          threatsBatch.push({
            tempLogIndex: tempIndex,
            job_id: jobId,
            type: threat.type,
            severity: threat.severity,
            matched_pattern: threat.matched_pattern
          });
        }
      }

      // Flush batch when it reaches threshold
      if (logsBatch.length >= BATCH_SIZE) {
        insertLogsAndThreatsBatch(logsBatch, threatsBatch);
        logsBatch = [];
        threatsBatch = [];
        tempIndexCounter = 0;

        // Throttle updates to DB/frontend polling (every 500ms max) to save overhead
        if (Date.now() - lastProgressUpdate > 500) {
          const progress = Math.min(Math.round((parsedLines / totalLines) * 100), 99);
          updateJobStatus(jobId, 'processing', progress, parsedLines, totalLines, attacksFound);
          lastProgressUpdate = Date.now();
        }
      }
    }

    // Flush any remaining lines
    if (logsBatch.length > 0) {
      insertLogsAndThreatsBatch(logsBatch, threatsBatch);
    }

    // Mark job as completed
    updateJobStatus(jobId, 'completed', 100, parsedLines, totalLines, attacksFound);

  } catch (err) {
    console.error(`Error processing job ${jobId}:`, err);
    updateJobStatus(jobId, 'failed', 0, parsedLines, totalLines, attacksFound);
  } finally {
    // Clean up temporary file once parsing terminates
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupErr) {
      console.error('Failed to delete temp upload file:', cleanupErr);
    }
  }
}
