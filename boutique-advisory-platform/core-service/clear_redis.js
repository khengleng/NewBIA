
const Redis = require('ioredis');
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.error('REDIS_URL is not set');
    process.exit(1);
}

const redis = new Redis(redisUrl);

async function main() {
    const emails = ['advisor@cambobia.com', 'investor@cambobia.com'];
    const ips = ['45.118.77.144', '127.0.0.1'];

    for (const email of emails) {
        await redis.del(`bia:lockout:${email}`);
        for (const ip of ips) {
            await redis.del(`bia:rl:auth:auth:login:${ip}:${email}`);
        }
    }
    console.log('Cleared lockout keys in Redis.');
    await redis.quit();
}

main().catch(console.error);
