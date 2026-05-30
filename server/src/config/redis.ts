import { createClient } from 'redis';
import { config } from './index';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => console.error('Redis Client Error:', err));

export async function connectRedis() {
  await redis.connect();
  console.log('Redis connected');
}
