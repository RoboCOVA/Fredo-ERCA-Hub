// PM2 Ecosystem Configuration for Fredo ERCA Hub
module.exports = {
  apps: [
    {
      name: 'fredo-erca-hub',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=fredo-taxpos-db --local --ip 0.0.0.0 --port 3001',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
