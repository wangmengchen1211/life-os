import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// 本地开发使用 postgres.js 驱动
// 生产环境可切换为 @neondatabase/serverless
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
