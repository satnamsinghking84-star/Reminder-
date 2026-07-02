import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import webpush from "web-push";

const app = express();
const PORT = 3000;

app.use(express.json());

// Load or generate VAPID keys
const KEYS_FILE = path.join(process.cwd(), '.vapid-keys.json');
let vapidKeys = { publicKey: '', privateKey: '' };

if (fs.existsSync(KEYS_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading VAPID keys file:', e);
  }
}

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.log('Generating fresh VAPID keys...');
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys), 'utf8');
}

webpush.setVapidDetails(
  'mailto:satnamsinghking84@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Memory database for subscriptions and reminders
const DB_FILE = path.join(process.cwd(), '.reminders-db.json');
interface DbSchema {
  syncs: Array<{
    subscription: any;
    reminders: Array<{
      id: string;
      title: string;
      notes: string;
      dateTime: string;
      triggered: boolean;
      createdAt: string;
    }>;
  }>;
}
let db: DbSchema = { syncs: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading DB file:', e);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving DB file:', e);
  }
}

// API Routes
app.get("/api/vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.get("/api/reminders/status", (req, res) => {
  const { endpoint } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  const sync = db.syncs.find(s => s.subscription.endpoint === endpoint);
  if (!sync) {
    return res.json({ reminders: [] });
  }

  res.json({ reminders: sync.reminders });
});

app.post("/api/reminders/sync", (req, res) => {
  const { subscription, reminders } = req.body;
  if (!subscription) {
    return res.status(400).json({ error: 'Subscription is required' });
  }

  const endpoint = subscription.endpoint;
  const existingIndex = db.syncs.findIndex(s => s.subscription.endpoint === endpoint);

  if (existingIndex >= 0) {
    db.syncs[existingIndex].reminders = reminders;
    db.syncs[existingIndex].subscription = subscription;
  } else {
    db.syncs.push({ subscription, reminders });
  }

  saveDb();
  res.json({ success: true, count: reminders.length });
});

// Alarm polling trigger running every 15 seconds to send notifications on-time!
setInterval(() => {
  const now = Date.now();
  let updated = false;

  db.syncs.forEach((sync) => {
    sync.reminders.forEach((reminder) => {
      if (!reminder.triggered) {
        const remTime = new Date(reminder.dateTime).getTime();
        
        // Match scheduled time (with 10-minute grace period to prevent old reminders spamming on restart)
        if (remTime <= now && now - remTime < 10 * 60 * 1000) {
          reminder.triggered = true;
          updated = true;

          const payload = JSON.stringify({
            title: `⏰ अलार्म: ${reminder.title}`,
            body: reminder.notes || 'समय हो गया है!',
            tag: reminder.id
          });

          console.log(`[Push Server] Sending reminder push for "${reminder.title}"`);
          webpush.sendNotification(sync.subscription, payload)
            .catch(err => {
              console.error(`[Push Server] Failed to send push to ${sync.subscription.endpoint}:`, err.statusCode);
            });
        } else if (remTime <= now) {
          reminder.triggered = true;
          updated = true;
        }
      }
    });
  });

  if (updated) {
    saveDb();
  }
}, 15000);

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
