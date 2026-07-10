const path = require('path');
const fs = require('fs');
const webpush = require('web-push');

// Manual env parser (so we don't need to install dotenv)
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
}

console.log("Subject:", process.env.VAPID_SUBJECT);
console.log("Public Key:", process.env.VAPID_PUBLIC_KEY ? "EXISTS" : "MISSING");
console.log("Private Key:", process.env.VAPID_PRIVATE_KEY ? "EXISTS" : "MISSING");

try {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://localhost:3000',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || ''
  );
  console.log("✅ VAPID configuration is valid!");
} catch (err) {
  console.error("❌ VAPID configuration error:", err.message);
}
