/**
 * WhatsApp-Telegram Bot - Renungan Harian
 * Main Entry Point - Optimized for GCP Free Tier
 *
 * Fokus: Renungan Harian Multi-Group
 * Mode: Webhook (hemat bandwidth) atau Polling (fallback)
 */

require("dotenv").config();

const {
  startTelegramBot,
  bot,
  getBotMode,
  cleanupWebhook,
} = require("./botTelegram");
const { initWhatsApp } = require("./botWhatsApp");
const { startRenunganScheduler } = require("./renunganHandler");
const { loadConfig } = require("./utils/configManager");

// Banner
const botMode = process.env.WEBHOOK_URL ? "WEBHOOK" : "POLLING";
console.log(`
╔═══════════════════════════════════════════════════════╗
║     WhatsApp-Telegram Bot v6.0 (${botMode})          ║
║    Renungan Harian - Baileys (No Chromium!)          ║
╚═══════════════════════════════════════════════════════╝
`);

(async () => {
  const startTime = Date.now();

  console.log("🚀 Memulai sistem...");
  console.log(
    `📅 ${new Date().toLocaleString("id-ID", {
      timeZone: process.env.TIMEZONE,
    })}`,
  );
  console.log(`⏰ Timezone: ${process.env.TIMEZONE || "Asia/Makassar"}`);
  console.log("─".repeat(50));

  // Validasi konfigurasi
  const requiredEnv = ["TELEGRAM_BOT_TOKEN"];
  // Check AI API key (salah satu harus ada: Custom, OpenRouter, atau Gemini)
  const hasCustomAI = process.env.AI_API_KEY && process.env.AI_API_ENDPOINT;
  const hasOpenRouter = process.env.OPENROUTER_API_KEY;
  const hasGemini = process.env.GEMINI_API_KEY;
  const hasAIKey = hasCustomAI || hasOpenRouter || hasGemini;
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0 || !hasAIKey) {
    console.error("❌ Environment variables tidak lengkap:");
    missingEnv.forEach((key) => console.error(`   - ${key}`));
    if (!hasAIKey) {
      console.error(
        "   - AI_API_KEY + AI_API_ENDPOINT (custom) ATAU OPENROUTER_API_KEY ATAU GEMINI_API_KEY",
      );
    }
    console.error("\nSilakan lengkapi file .env");
    process.exit(1);
  }

  // Log AI provider yang digunakan
  if (hasCustomAI) {
    console.log(`🤖 AI Provider: Custom (${process.env.AI_API_ENDPOINT})`);
  } else if (hasOpenRouter) {
    console.log("🤖 AI Provider: OpenRouter");
  } else if (hasGemini) {
    console.log("🤖 AI Provider: Gemini");
  }

  if (!process.env.ADMIN_TELEGRAM_IDS) {
    console.warn("⚠️  ADMIN_TELEGRAM_IDS belum diatur!");
    console.warn("   Bot tidak akan bisa digunakan tanpa admin.\n");
  }

  try {
    // 0. Load persistent config
    console.log("📂 Loading bot configuration...");
    const config = await loadConfig();
    if (config) {
      // Sync config dari file ke environment variables
      if (config.renunganGroupId)
        process.env.RENUNGAN_GROUP_ID = config.renunganGroupId;
      if (config.renunganTime) process.env.RENUNGAN_TIME = config.renunganTime;
      console.log("✅ Config loaded dari file");
      console.log(
        `   📖 Renungan: ${config.renunganTime} → Grup: ${
          config.renunganGroupId || "Belum diatur"
        }`,
      );
      if (config.multiGroupEnabled && config.renunganGroups?.length > 0) {
        console.log(`   📡 Multi-Group: ${config.renunganGroups.length} grup`);
      }
    }

    // 1. Inisialisasi WhatsApp (dengan Telegram bot untuk QR)
    console.log("📱 Menginisialisasi WhatsApp (Baileys - No Chromium)...");
    await initWhatsApp(bot);

    // 2. Start Telegram Bot
    console.log("🤖 Memulai Telegram Bot...");
    startTelegramBot();

    // 3. Start Renungan Scheduler
    console.log("⏰ Mengatur jadwal renungan...");
    startRenunganScheduler();

    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("─".repeat(50));
    console.log(`✅ Sistem siap dalam ${loadTime}s`);
    console.log("");
    console.log(
      "📖 Renungan harian akan dikirim jam " +
        (process.env.RENUNGAN_TIME || "08:00"),
    );
    console.log("");
    console.log("💡 Gunakan Telegram Bot untuk mengontrol sistem");
    console.log("─".repeat(50));

    // Bot mode info
    const modeInfo = getBotMode();
    console.log(`🌐 Telegram Mode: ${modeInfo.mode.toUpperCase()}`);
    console.log(`📊 Est. Bandwidth: ${modeInfo.bandwidthEstimate}`);
    if (modeInfo.mode === "webhook") {
      console.log(`🔗 Webhook: ${modeInfo.webhookUrl}`);
    }

    // Memory usage info
    const used = process.memoryUsage();
    console.log(
      `💾 Memory Usage: ${Math.round(used.heapUsed / 1024 / 1024)}MB`,
    );
  } catch (error) {
    console.error("❌ Error fatal:", error.message);
    console.error(error.stack);
    console.log("🔄 Bot akan tetap berjalan, silakan cek konfigurasi...");
  }

  // ============================================
  // GRACEFUL SHUTDOWN HANDLERS
  // ============================================

  const gracefulShutdown = async (signal) => {
    console.log(`\n\n⏸️  Menerima ${signal}, shutdown gracefully...`);

    // Cleanup webhook jika pakai webhook mode
    try {
      await cleanupWebhook();
    } catch (e) {
      // Ignore cleanup errors
    }

    process.exit(0);
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Prevent crash dari unhandled errors
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error.message);
    // Jangan exit, biarkan bot tetap jalan
  });

  // ============================================
  // MEMORY MONITORING (Baileys - target ~128MB)
  // ============================================

  const IS_RENDER = !!process.env.RENDER;
  const MEMORY_CHECK_INTERVAL = IS_RENDER ? 5 * 60 * 1000 : 30 * 60 * 1000; // 5 min (Render) / 30 min (other)
  const MEMORY_WARN_MB = IS_RENDER ? 200 : 180;    // Warning threshold
  const MEMORY_KILL_MB = IS_RENDER ? 350 : 999;     // Auto-restart threshold (Render: before 512MB limit)
  const AUTO_RESTART_HOURS = IS_RENDER ? 12 : 24;   // Periodic restart (prevent long-term leak)

  console.log(`🧠 Memory monitor: warn >${MEMORY_WARN_MB}MB, restart >${MEMORY_KILL_MB}MB`);
  console.log(`🔄 Auto-restart: every ${AUTO_RESTART_HOURS}h`);

  // Log & monitor memory usage
  setInterval(
    () => {
      const used = process.memoryUsage();
      const heapMB = Math.round(used.heapUsed / 1024 / 1024);
      const rssMB = Math.round(used.rss / 1024 / 1024);
      const uptimeH = (process.uptime() / 3600).toFixed(1);

      console.log(
        `📊 Memory: Heap ${heapMB}MB | RSS ${rssMB}MB | Uptime: ${uptimeH}h`,
      );

      // Force GC jika memory tinggi
      if (rssMB > MEMORY_WARN_MB) {
        console.warn(
          `⚠️ Memory tinggi! RSS: ${rssMB}MB (threshold: ${MEMORY_WARN_MB}MB)`,
        );
        if (global.gc) {
          global.gc();
          const afterGC = Math.round(process.memoryUsage().rss / 1024 / 1024);
          console.log(`🧹 GC done: ${rssMB}MB → ${afterGC}MB`);
        }
      }

      // Auto-restart jika memory kritis (Render: graceful exit → Render auto-restarts)
      if (rssMB > MEMORY_KILL_MB) {
        console.error(
          `🚨 Memory critical! RSS: ${rssMB}MB > ${MEMORY_KILL_MB}MB — restarting...`,
        );
        if (IS_RENDER) {
          // On Render: process.exit → Render auto-restarts the service
          process.exit(1);
        } else {
          // On PM2: process.exit → PM2 auto-restarts
          process.exit(0);
        }
      }
    },
    MEMORY_CHECK_INTERVAL,
  );

  // Periodic auto-restart (prevent long-term memory leak accumulation)
  setTimeout(
    () => {
      console.log(
        `🔄 Periodic restart after ${AUTO_RESTART_HOURS}h — preventing memory leak`,
      );
      process.exit(0);
    },
    AUTO_RESTART_HOURS * 60 * 60 * 1000,
  );
})();
