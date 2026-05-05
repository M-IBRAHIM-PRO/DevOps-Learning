const http = require("http");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

loadEnvFile();

const connectionString = getConnectionString();
const client = new Client(
  connectionString
    ? { connectionString }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        database: process.env.DB_NAME || "postgres",
      }
);

const server = http.createServer(async (req, res) => {
  try {
    const result = await client.query("SELECT NOW()");
    res.end(`DB Time: ${result.rows[0].now}`);
  } catch (error) {
    res.statusCode = 500;
    res.end("Database query failed");
    console.error("Database query failed:", error.message);
  }
});

async function startServer() {
  await client.connect();

  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

function getConnectionString() {
  const dbHost = process.env.DB_HOST;

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (dbHost && /^postgres(ql)?:\/\//.test(dbHost)) {
    return dbHost;
  }

  return undefined;
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);

    if (!match) {
      continue;
    }

    const key = match[1];
    const value = (match[2] || "").replace(/^['"]|['"]$/g, "");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
