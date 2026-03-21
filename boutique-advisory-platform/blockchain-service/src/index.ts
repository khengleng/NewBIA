import { createServer } from 'http';
import { config } from './config';
import { createApp } from './app';

const app = createApp();
const server = createServer(app);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`${config.serviceName} listening on ${config.port} (mode=${config.mode})`);
});
