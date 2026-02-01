// ecosystem.config.cjs
// PM2 Configuration para UniPanel
// Uso: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      // Backend - API Node.js
      name: 'unipanel-api',
      script: './backend/index.js',
      cwd: '/root/unipanel',
      interpreter: 'node',
      node_args: '--experimental-specifier-resolution=node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      error_file: '/root/unipanel/logs/api-error.log',
      out_file: '/root/unipanel/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    },
    {
      // Frontend - Servidor estático (serve)
      name: 'unipanel-web',
      script: 'npx',
      args: 'serve -s dist -l 5173',
      cwd: '/root/unipanel/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/unipanel/logs/web-error.log',
      out_file: '/root/unipanel/logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    }
  ]
};
