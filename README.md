# 🤖 JhopanWa Bot Renungan - Baileys Edition

Bot WhatsApp & Telegram untuk Renungan Harian dengan AI. Menggunakan **Baileys** (tanpa Chromium) — sangat ringan dan hemat resource.

## ✨ Fitur

- 📖 **Renungan Harian Otomatis** — AI generate renungan berdasarkan ayat Alkitab
- 🤖 **Dual Bot** — WhatsApp + Telegram berjalan bersamaan
- 🎂 **Ucapan Ulang Tahun** — Otomatis kirim ucapan ke member grup
- 🌐 **Multi-Group** — Kirim renungan ke beberapa grup dengan delay
- ⚙️ **Panel Kontrol Telegram** — Kelola semua setting dari Telegram
- 🧠 **AI-Powered** — Custom OpenAI-compatible API / Gemini / OpenRouter
- 💾 **Ultra Ringan** — ~100MB RAM, tanpa browser (Baileys)

## 📊 Resource Usage

| Resource | Nilai |
|----------|-------|
| RAM | ~100 MB |
| CPU | < 1% |
| Bandwidth (Polling) | ~750 MB/bulan |
| Bandwidth (Webhook) | ~200 MB/bulan |
| Min. VPS | 256 MB RAM |

## 🚀 Quick Start

### Option 1: Setup Wizard (Recommended)

```bash
# Clone repo
git clone https://github.com/jhopan/JhopanWaBotRenunganBaileys.git
cd JhopanWaBotRenunganBaileys

# Jalankan setup wizard (auto-detect OS)
npm run setup

# Atau manual:
# Linux:  bash setup.sh
# Windows: setup.bat
```

### Option 2: Manual Setup

```bash
# Clone repo
git clone https://github.com/jhopan/JhopanWaBotRenunganBaileys.git
cd JhopanWaBotRenunganBaileys

# Install dependencies
npm install

# Copy dan edit .env
cp .env.example .env
nano .env  # atau edit di editor favorit

# Start bot
npm start
```

### Option 3: Production (PM2)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## ⚙️ Konfigurasi

### Environment Variables (.env)

```env
# Timezone
TIMEZONE=Asia/Makassar

# Telegram Bot (wajib)
TELEGRAM_BOT_TOKEN=***_ADMIN_TELEGRAM_IDS=123456789

# AI Provider (salah satu)
# Option A: Custom OpenAI-Compatible API
AI_API_KEY=your_a***_API_ENDPOINT=https://your-api-endpoint.com/v1
AI_MODEL=gemini/gemini-2.5-flash-lite

# Option B: OpenRouter
OPENROUTER_API_KEY=your_ope...n
# Option C: Google Gemini
GEMINI_API_KEY=your_gem...y

# Renungan
RENUNGAN_GROUP_ID=
RENUNGAN_TIME=08:00

# Webhook (opsional - hemat bandwidth)
# WEBHOOK_URL=https://your-domain.com
# WEBHOOK_PORT=3000
```

### Cara Dapat Credentials

| Credential | Cara Dapat |
|------------|------------|
| `TELEGRAM_BOT_TOKEN` | Chat [@BotFather](https://t.me/BotFather) → `/newbot` |
| `ADMIN_TELEGRAM_IDS` | Chat [@userinfobot](https://t.me/userinfobot) |
| `AI_API_KEY` | Dari provider AI kamu |

## 📁 Struktur Project

```
JhopanWaBotRenunganBaileys/
├── src/
│   ├── index.js              # Entry point
│   ├── botWhatsApp.js        # WhatsApp bot (Baileys)
│   ├── botTelegram.js        # Telegram bot (panel kontrol)
│   ├── renunganHandler.js    # Cron job renungan
│   ├── services/
│   │   └── aiService.js      # AI provider (Custom/Gemini/OpenRouter)
│   ├── utils/
│   │   ├── configManager.js  # Config management
│   │   ├── dateHelper.js     # Date utilities
│   │   ├── fileHelper.js     # File operations
│   │   └── logger.js         # Logging
│   └── data/                 # Data storage (JSON)
├── setup.sh                  # Setup wizard (Linux)
├── setup.bat                 # Setup wizard (Windows)
├── setup-gcp.sh              # Setup script untuk GCP/VPS
├── ecosystem.config.js       # PM2 configuration
├── package.json              # Dependencies
├── .env.example              # Environment template
└── README.md                 # This file
```

## 🌐 Cloudflare Tunnel (Webhook Mode)

Untuk menghemat bandwidth ~70%, gunakan webhook mode dengan Cloudflare Tunnel:

```bash
# Setup wizard akan tanya "Setup Cloudflare Tunnel?"
# Jawab Y dan ikuti instruksinya
npm run setup
```

**Requirements:**
- Akun Cloudflare (gratis)
- Domain yang di-manage di Cloudflare
- cloudflared terinstall

**Hasil:**
- URL permanent (misal `https://wa-bot.domain.com`)
- Bandwidth turun dari ~750MB → ~200MB/bulan
- Tidak perlu IP eksternal

## 🔧 Commands

| Command | Fungsi |
|---------|--------|
| `npm start` | Start bot (development) |
| `npm run start:prod` | Start dengan optimasi memory |
| `npm run dev` | Start dengan auto-reload |
| `npm run setup` | Setup wizard |
| `npm run tunnel` | Quick tunnel (URL random) |
| `pm2 start ecosystem.config.js` | Production mode |

## 📋 Telegram Commands

| Command | Fungsi |
|---------|--------|
| `/start` | Panel kontrol utama |
| `/status` | Status bot & koneksi |
| `/test` | Test kirim renungan |
| `/settings` | Pengaturan bot |
| `/verses` | Kelola daftar ayat |

## 🏗️ Tech Stack

- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — WhatsApp Web API (no Chromium!)
- **[node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)** — Telegram Bot API
- **[Express](https://expressjs.com/)** — Webhook server
- **[node-cron](https://github.com/node-cron/node-cron)** — Task scheduler
- **[axios](https://axios-http.com/)** — HTTP client (AI API calls)

## 📝 Migrasi dari whatsapp-web.js

Project ini di-migrasi dari `whatsapp-web.js` ke **Baileys** untuk:

| Aspek | Sebelum (wwebjs) | Sesudah (Baileys) |
|-------|-------------------|---------------------|
| RAM | 300-500 MB | ~100 MB |
| Disk (deps) | ~300 MB (Chromium) | ~10 MB |
| Startup | 10-30 detik | 2-5 detik |
| Min. VPS | 1 GB RAM | 256 MB RAM |
| Browser | Chrome/Chromium | Tidak perlu |

## 🙏 Credits

- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API (lightweight, no Chromium)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) — Telegram Bot API
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) — Free HTTPS tunnel
- [Google Gemini AI](https://ai.google.dev/) — AI provider

## 📄 License

MIT License — Bebas digunakan dan dimodifikasi.

---

Made with ❤️ by [Jhopan](https://github.com/jhopan)
