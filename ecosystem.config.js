/**
 * PM2 Ecosystem Configuration
 * Baileys Version - Ultra Lightweight (No Chromium!)
 * Optimized for VPS/VM 256MB RAM minimum
 */

module.exports = {
  apps: [
    {
      name: "renungan-bot",
      script: "src/index.js",

      // Node.js memory - 256MB cukup untuk Baileys (sebelumnya butuh 480MB)
      node_args: "--expose-gc --max-old-space-size=256 --optimize-for-size",

      // Auto restart jika memory > 256MB (Baileys biasanya hanya ~80-120MB)
      max_memory_restart: "256M",

      // Environment
      env: {
        NODE_ENV: "production",
      },

      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,

      // Restart behavior
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5000,

      // Watch disabled (save CPU)
      watch: false,

      // Cron restart - restart setiap hari jam 3 pagi (WITA - Asia/Makassar)
      // Fungsi: Bersihkan memory leak, fresh start, prevent OOM
      // Format: minute hour day month day-of-week
      cron_restart: "0 3 * * *",

      // Kill timeout
      kill_timeout: 10000,

      // Single instance only
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
