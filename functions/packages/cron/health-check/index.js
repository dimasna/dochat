const https = require("https");

function request(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

async function main(args) {
  const appUrl = args.APP_URL || process.env.APP_URL;
  const cronSecret = args.CRON_SECRET || process.env.CRON_SECRET;

  if (!appUrl || !cronSecret) {
    return { body: { error: "APP_URL and CRON_SECRET are required" } };
  }

  try {
    const data = await request(`${appUrl}/api/cron/health-check`, {
      Authorization: `Bearer ${cronSecret}`,
    });
    console.log(`Health check: checked=${data.checked}, recovered=${data.recovered?.length || 0}`);
    return { body: data };
  } catch (err) {
    console.error("Health check failed:", err.message);
    return { body: { error: err.message } };
  }
}

exports.main = main;
