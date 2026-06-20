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
const mongoService = require("./services/mongoService");
const bibleScrapeScheduler = require("./services/bibleScrapeScheduler");

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
    // 0a. Initialize MongoDB (if configured)
    console.log("🗄️  Checking MongoDB connection...");
    await mongoService.connect();
    const dbStatus = mongoService.getStatus();
    if (dbStatus.connected) {
      console.log(`   ✅ MongoDB: ${dbStatus.database}`);
    } else {
      console.log("   📁 MongoDB: not available, using local file storage");
      if (!dbStatus.configured) {
        console.log("   💡 Set MONGODB_URI in .env to enable cloud storage");
      }
    }

    // 0b. Load persistent config
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

    // Show pool stats
    try {
      const versePool = require("./services/versePool");
      const { getVerseMode } = (() => {
        // Quick mode check without importing renunganHandler
        const mode = (process.env.VERSE_MODE || "bible").toLowerCase();
        if (mode === "pool") return { getVerseMode: () => "pool" };
        if (mode === "yearly") return { getVerseMode: () => "yearly" };
        return { getVerseMode: () => "bible" };
      })();
      const mode = getVerseMode();

      if (mode === "bible") {
        console.log(`📖 Verse mode: BIBLE`);
        try {
          const bibleVerseDB = require("./services/bibleVerseDB");
          const bibleStats = await bibleVerseDB.getStats();
          console.log(`   ${bibleStats.totalVerses} ayat dari ${bibleStats.booksInDB} kitab`);
          console.log(`   📚 Tracking: Tidak (infinite variety)`);
        } catch (e) {
          console.log(`   ⚠️ Stats belum tersedia: ${e.message}`);
          console.log(`   📚 Tracking: Tidak (infinite variety)`);
        }
        // Show today theme from pool system
        try {
          const todayTheme = await versePool.getTodayTheme();
          if (todayTheme) {
            console.log(`   🎨 Today theme: ${todayTheme.theme} (${todayTheme.reason || ""})`);
          }
        } catch (e) { /* ignore */ }
      } else if (mode === "pool") {
        const stats = await versePool.getPoolStats();
        console.log(`📖 Verse mode: POOL`);
        console.log(`   ${stats.used}/${stats.total} terpakai, ${stats.unused} tersisa (~${stats.estimatedYearsLeft} tahun)`);
        console.log(`   🎉 Special days: ${stats.specialDays} | Resets: ${stats.totalResets}`);
        if (stats.todayTheme) {
          console.log(`   🎨 Today theme: ${stats.todayTheme.theme} (${stats.todayTheme.reason || ""})`);
        }
      } else {
        const year = new Date().getFullYear();
        const mongoData = require("./services/mongoDataService");
        const data = await mongoData.loadVerses(year);
        const used = (data.verses || []).filter(v => v.used).length;
        const total = (data.verses || []).length;
        console.log(`📖 Verse mode: YEARLY`);
        console.log(`   ${year}: ${used}/${total} terpakai, ${total - used} tersisa`);
      }
    } catch (e) {
      console.log("📖 Verses: sedang dimuat...", e.message);
    }

    // 4. Start Bible Scrape Scheduler (1 kitab/jam, pause 07-09)
    if (mongoService.isConnected()) {
      bibleScrapeScheduler.startScheduler();
    } else {
      console.log("⚠️  Bible scraper tidak dimulai (MongoDB tidak terhubung)");
    }

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

    // Stop Bible Scraper Scheduler
    try {
      bibleScrapeScheduler.stopScheduler();
    } catch (e) {
      // Ignore cleanup errors
    }

    // Disconnect MongoDB
    try {
      await mongoData.disconnect();
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
  // MEMORY MONITORING
  // ============================================

  setInterval(
    () => {
      const used = process.memoryUsage();
      const heapMB = Math.round(used.heapUsed / 1024 / 1024);
      const rssMB = Math.round(used.rss / 1024 / 1024);
      const uptimeH = (process.uptime() / 3600).toFixed(1);

      console.log(
        `📊 Memory: Heap ${heapMB}MB | RSS ${rssMB}MB | Uptime: ${uptimeH}h`,
      );
    },
    30 * 60 * 1000,
  ); // 30 menit
})();
