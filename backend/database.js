import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'loglens.db');
const db = new DatabaseSync(dbPath);

export function initDb() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      total_lines INTEGER DEFAULT 0,
      parsed_lines INTEGER DEFAULT 0,
      attacks_found INTEGER DEFAULT 0,
      filename TEXT NOT NULL,
      created_at TEXT NOT NULL,
      finished_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      ip TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      method TEXT,
      path TEXT,
      status_code INTEGER,
      size INTEGER,
      user_agent TEXT,
      country TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS threats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id INTEGER,
      job_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      matched_pattern TEXT NOT NULL
    )
  `);

  // Create indexes to optimize aggregation speeds
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_job_id ON logs(job_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_ip ON logs(ip)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_threats_job_id ON threats(job_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_threats_type ON threats(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_threats_log_id ON threats(log_id)`);
}

export function createJob(id, filename) {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, status, progress, total_lines, parsed_lines, attacks_found, filename, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, 'pending', 0, 0, 0, 0, filename, new Date().toISOString());
}

export function updateJobStatus(id, status, progress, parsedLines, totalLines, attacksFound) {
  const finishedAt = (status === 'completed' || status === 'failed') ? new Date().toISOString() : null;
  
  if (finishedAt) {
    const stmt = db.prepare(`
      UPDATE jobs 
      SET status = ?, progress = ?, parsed_lines = ?, total_lines = ?, attacks_found = ?, finished_at = ?
      WHERE id = ?
    `);
    stmt.run(status, progress, parsedLines, totalLines, attacksFound, finishedAt, id);
  } else {
    const stmt = db.prepare(`
      UPDATE jobs 
      SET status = ?, progress = ?, parsed_lines = ?, total_lines = ?, attacks_found = ?
      WHERE id = ?
    `);
    stmt.run(status, progress, parsedLines, totalLines, attacksFound, id);
  }
}

export function getJob(id) {
  const stmt = db.prepare(`SELECT * FROM jobs WHERE id = ?`);
  return stmt.get(id);
}

export function getJobs() {
  const stmt = db.prepare(`SELECT * FROM jobs ORDER BY created_at DESC`);
  return stmt.all();
}

export function insertLogsAndThreatsBatch(logsBatch, threatsBatch) {
  db.exec('BEGIN TRANSACTION');
  try {
    const insertLogStmt = db.prepare(`
      INSERT INTO logs (job_id, ip, timestamp, method, path, status_code, size, user_agent, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertThreatStmt = db.prepare(`
      INSERT INTO threats (log_id, job_id, type, severity, matched_pattern)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const log of logsBatch) {
      const info = insertLogStmt.run(
        log.job_id,
        log.ip,
        log.timestamp,
        log.method,
        log.path,
        log.status_code,
        log.size,
        log.user_agent,
        log.country || 'Unknown'
      );
      
      const logId = info.lastInsertRowid;
      
      // Filter threats associated with this log's temporary array index
      const associatedThreats = threatsBatch.filter(t => t.tempLogIndex === log.tempIndex);
      for (const threat of associatedThreats) {
        insertThreatStmt.run(
          logId,
          threat.job_id,
          threat.type,
          threat.severity,
          threat.matched_pattern
        );
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Queries for analytics dashboard
export function getJobStats(jobId) {
  const totalLogsStmt = db.prepare(`SELECT COUNT(*) as count FROM logs WHERE job_id = ?`);
  const totalAttacksStmt = db.prepare(`SELECT COUNT(*) as count FROM threats WHERE job_id = ?`);
  const uniqueIPsStmt = db.prepare(`SELECT COUNT(DISTINCT ip) as count FROM logs WHERE job_id = ?`);
  const highSeverityStmt = db.prepare(`SELECT COUNT(*) as count FROM threats WHERE job_id = ? AND severity = 'high'`);

  const totalLogs = totalLogsStmt.get(jobId)?.count || 0;
  const totalAttacks = totalAttacksStmt.get(jobId)?.count || 0;
  const uniqueIPs = uniqueIPsStmt.get(jobId)?.count || 0;
  const highSeverity = highSeverityStmt.get(jobId)?.count || 0;

  return {
    totalLogs,
    totalAttacks,
    uniqueIPs,
    highSeverity
  };
}

export function getTimelineStats(jobId) {
  // Aggregate attacks hourly. We slice YYYY-MM-DDTHH:00:00Z from the timestamp ISO strings
  const stmt = db.prepare(`
    SELECT SUBSTR(l.timestamp, 1, 13) || ':00:00Z' as hour, COUNT(t.id) as count
    FROM threats t
    JOIN logs l ON t.log_id = l.id
    WHERE t.job_id = ?
    GROUP BY hour
    ORDER BY hour ASC
  `);
  return stmt.all(jobId);
}

export function getThreatDistribution(jobId) {
  const stmt = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM threats
    WHERE job_id = ?
    GROUP BY type
  `);
  return stmt.all(jobId);
}

export function getTopAttackers(jobId) {
  const stmt = db.prepare(`
    SELECT 
      l.ip, 
      l.country,
      COUNT(l.id) as total_requests,
      COUNT(t.id) as attack_requests,
      MAX(t.severity) as max_severity
    FROM logs l
    LEFT JOIN threats t ON l.id = t.log_id
    WHERE l.job_id = ?
    GROUP BY l.ip, l.country
    HAVING attack_requests > 0
    ORDER BY attack_requests DESC
    LIMIT 20
  `);
  return stmt.all(jobId);
}
