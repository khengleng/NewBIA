import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const isTest = process.env.NODE_ENV === 'test';
const maxRetryAttempts = isTest ? 0 : 10;

const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 5000, // 5 seconds to connect
    commandTimeout: 3000, // 3 seconds per command
    enableOfflineQueue: false, // Fail immediately if not connected
    lazyConnect: isTest,
    retryStrategy(times: number) {
        if (times > maxRetryAttempts) {
            return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});


redis.on('error', (err: Error) => {
    if (isTest) return;
    console.error('Redis connection error:', err);
});

redis.on('connect', () => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('Connected to Redis');
    }
});

export default redis;
