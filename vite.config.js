import { defineConfig } from 'vite';
import imcHandler from './api/imc.js';

export default defineConfig({
  plugins: [{
    name: 'api-imc-local',
    configureServer(server) {
      server.middlewares.use('/api/imc', (req, res) => {
        return imcHandler(req, res);
      });
    }
  }]
});
