import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, createJob, getJob, getJobStats, getThreatDistribution, getTopAttackers } from './database.js';
import { parseLogFile } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  console.log('--- Starting LogLens Backend Integration Test ---');
  
  // 1. Initialize DB
  initDb();
  console.log('Database initialized.');

  // 2. Prepare test files
  const demoLogPath = path.join(__dirname, 'demo.log');
  const tempTestLogPath = path.join(__dirname, 'uploads', 'test-run.log');
  
  if (!fs.existsSync(path.dirname(tempTestLogPath))) {
    fs.mkdirSync(path.dirname(tempTestLogPath), { recursive: true });
  }
  
  fs.copyFileSync(demoLogPath, tempTestLogPath);
  console.log('Demo log file copied to temporary parsing buffer.');

  const testJobId = 'test-job-uuid-12345';

  // Overwrite existing job if any from previous runs
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(path.join(__dirname, 'data', 'loglens.db'));
    db.prepare('DELETE FROM jobs WHERE id = ?').run(testJobId);
    db.prepare('DELETE FROM logs WHERE job_id = ?').run(testJobId);
    db.prepare('DELETE FROM threats WHERE job_id = ?').run(testJobId);
  } catch (err) {
    // Ignore if table doesn't exist yet
  }

  // Register the test job
  createJob(testJobId, 'demo.log');

  // 3. Trigger Parse
  console.log('Launching parseLogFile stream scanner...');
  await parseLogFile(tempTestLogPath, testJobId);
  console.log('Stream scanner finished.');

  // 4. Verify Database Records
  const job = getJob(testJobId);
  console.log('\nJob Metadata from DB:');
  console.log(JSON.stringify(job, null, 2));

  if (!job) {
    throw new Error('TEST FAILED: Job entry not found in SQLite!');
  }

  if (job.status !== 'completed') {
    throw new Error(`TEST FAILED: Job status is not "completed", got "${job.status}"`);
  }

  const stats = getJobStats(testJobId);
  console.log('\nDatabase Statistics:');
  console.log(JSON.stringify(stats, null, 2));

  if (stats.totalLogs !== 30) {
    throw new Error(`TEST FAILED: Expected exactly 30 parsed logs, but found ${stats.totalLogs}`);
  }

  if (stats.totalAttacks === 0) {
    throw new Error('TEST FAILED: Threat detection engine failed to detect any attacks!');
  }

  const distribution = getThreatDistribution(testJobId);
  console.log('\nThreat Type Breakdown:');
  console.log(JSON.stringify(distribution, null, 2));

  const threatTypes = distribution.map(d => d.type);
  const requiredThreats = ['sql_injection', 'xss', 'directory_traversal', 'brute_force'];
  for (const t of requiredThreats) {
    if (!threatTypes.includes(t)) {
      throw new Error(`TEST FAILED: Threat type "${t}" was not detected in logs!`);
    }
  }

  const attackers = getTopAttackers(testJobId);
  console.log('\nTop Attacking IPs & GeoIP results:');
  console.log(JSON.stringify(attackers, null, 2));

  const attackerIps = attackers.map(a => a.ip);
  if (!attackerIps.includes('1.1.1.1') || !attackerIps.includes('200.221.2.45')) {
    throw new Error('TEST FAILED: Expected attackers (e.g. 1.1.1.1 or 200.221.2.45) were not ranked!');
  }

  console.log('\n==================================================');
  console.log('🎉 SUCCESS: LogLens parsing & detection engine validated successfully!');
  console.log('==================================================');
}

runTest().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:');
  console.error(err);
  process.exit(1);
});
