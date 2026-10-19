import "dotenv/config";
import { Pool } from "pg";
import { createMariaDatabase } from "./mariadb.ts";
export const isMariaDB = /^(mysql|mariadb):/.test(
  process.env.DATABASE_URL ?? "",
);
export const db = process.env.DATABASE_URL
  ? isMariaDB
    ? createMariaDatabase(process.env.DATABASE_URL)
    : new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 5000,
        ssl:
          process.env.DATABASE_SSL === "true"
            ? { rejectUnauthorized: true }
            : undefined,
      })
  : null;
