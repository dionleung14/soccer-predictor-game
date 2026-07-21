import mysql from "mysql2/promise";

function stripQuotes(value) {
  if (value == null) return value;
  return String(value)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function connectionConfigFromUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\//, "").split("?")[0];

  const sslParam = parsed.searchParams.get("ssl");
  const wantsSsl =
    process.env.MYSQL_SSL === "true" ||
    (process.env.MYSQL_SSL !== "false" &&
      (sslParam === "true" || process.env.NODE_ENV === "production"));

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 5),
    namedPlaceholders: true,
    ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function connectionConfigFromDiscreteEnv() {
  const database = stripQuotes(
    process.env.DB_NAME || process.env.MYSQL_DATABASE,
  );
  const user = stripQuotes(
    process.env.DB_USERNAME_ROOT ||
      process.env.DB_USERNAME ||
      process.env.MYSQL_USER,
  );
  const password = stripQuotes(
    process.env.DB_PASSWORD_ROOT ||
      process.env.DB_PASSWORD ||
      process.env.MYSQL_PASSWORD ||
      "",
  );
  const host = stripQuotes(
    process.env.DB_HOST || process.env.MYSQL_HOST || "127.0.0.1",
  );
  const port = Number(
    stripQuotes(process.env.DB_PORT || process.env.MYSQL_PORT || "3306"),
  );

  if (!database || !user) {
    return null;
  }

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 5),
    namedPlaceholders: true,
    ...(process.env.MYSQL_SSL === "true"
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  };
}

/**
 * Resolves MySQL config for local DB_* vars and Heroku add-on URLs
 * (JAWSDB_URL / CLEARDB_DATABASE_URL / DATABASE_URL).
 * Local DB_NAME + credentials take precedence over DATABASE_URL.
 */
export function resolveMysqlConfig() {
  const discrete = connectionConfigFromDiscreteEnv();
  if (discrete) {
    return discrete;
  }

  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.JAWSDB_URL ||
    process.env.CLEARDB_DATABASE_URL ||
    process.env.MYSQL_URL;

  if (databaseUrl) {
    return connectionConfigFromUrl(databaseUrl);
  }

  return null;
}

let pool = null;

export function getPool() {
  if (pool) return pool;

  const config = resolveMysqlConfig();
  if (!config) {
    throw new Error(
      "MySQL is not configured. Set DB_NAME/DB_USERNAME_ROOT/DB_PASSWORD_ROOT or DATABASE_URL (JAWSDB_URL / CLEARDB_DATABASE_URL).",
    );
  }

  pool = mysql.createPool(config);
  return pool;
}

export async function checkDatabase() {
  const db = getPool();
  const [rows] = await db.query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
