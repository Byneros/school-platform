module.exports = {
  apps: [
    {
      name: "school-api",
      cwd: __dirname,
      script: "node",
      args: "apps/api/dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "4001"
      },
      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "4001"
      }
    },
    {
      name: "school-web",
      cwd: "apps/web",
      script: "node",
      args: "../../node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 4173 --strictPort",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "256M",
      time: true,
      env: {
        NODE_ENV: "production"
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
