import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { 
  initDb, 
  createJob, 
  getJob, 
  getJobs, 
  getJobStats, 
  getTimelineStats, 
  getThreatDistribution, 
  getTopAttackers 
} from './database.js';
import { parseLogFile } from './parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
initDb();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend flexibility
app.use(cors());
app.use(express.json());

// Set up upload directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${uniqueSuffix}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// API Endpoints

// 1. Get all parsing jobs
app.get('/api/jobs', (req, res) => {
  try {
    const jobs = getJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve jobs list', details: err.message });
  }
});

// 2. Upload file & start async parsing
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const jobId = crypto.randomUUID();
    const tempPath = req.file.path;
    const filename = req.file.originalname;

    // Register job in database
    createJob(jobId, filename);

    // Kick off parsing asynchronously (do not await)
    parseLogFile(tempPath, jobId)
      .then(() => console.log(`Job ${jobId} finished parsing.`))
      .catch((err) => console.error(`Job ${jobId} failed:`, err));

    // Respond immediately with the job token
    res.status(202).json({ jobId, message: 'Upload complete, parsing started.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initialize parsing job', details: err.message });
  }
});

// 3. Get job status (for polling)
app.get('/api/jobs/:id/status', (req, res) => {
  const jobId = req.params.id;
  try {
    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job status', details: err.message });
  }
});

// 4. Retrieve dashboard report data (aggregated details)
app.get('/api/jobs/:id/report', (req, res) => {
  const jobId = req.params.id;
  try {
    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Job analysis report is not ready yet', 
        status: job.status, 
        progress: job.progress 
      });
    }

    const stats = getJobStats(jobId);
    const timeline = getTimelineStats(jobId);
    const distribution = getThreatDistribution(jobId);
    const attackers = getTopAttackers(jobId);

    res.json({
      job,
      stats,
      timeline,
      distribution,
      attackers
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compile report metrics', details: err.message });
  }
});

// 5. Initialize a demo job using pre-loaded log data
app.post('/api/jobs/demo', (req, res) => {
  const demoLogPath = path.join(__dirname, 'demo.log');
  
  if (!fs.existsSync(demoLogPath)) {
    return res.status(404).json({ error: 'Demo log file not found. Generate it first.' });
  }

  try {
    const jobId = crypto.randomUUID();
    // Copy the demo file to uploads to isolate this specific job run
    const tempPath = path.join(uploadDir, `${Date.now()}-demo.log`);
    fs.copyFileSync(demoLogPath, tempPath);

    // Register job
    createJob(jobId, 'demo.log');

    // Parse in background
    parseLogFile(tempPath, jobId)
      .then(() => console.log(`Demo job ${jobId} finished parsing.`))
      .catch((err) => console.error(`Demo job ${jobId} failed:`, err));

    res.status(202).json({ jobId, message: 'Demo job started.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start demo job', details: err.message });
  }
});

// Serve static frontend assets in production
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start listening
app.listen(PORT, () => {
  console.log(`LogLens Express Server is running on port ${PORT}`);
});
