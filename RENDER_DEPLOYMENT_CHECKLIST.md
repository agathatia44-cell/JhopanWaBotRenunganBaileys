# 🚀 Render Deployment Checklist

Panduan lengkap untuk deploy bot ke Render dengan Pool mode + TTS.

---

## ✅ Pre-Deployment Checklist

### 1. MongoDB Atlas (Database)

```
✅ Buat MongoDB Atlas cluster (free tier M0)
✅ Buat database: whatsapp_bot
✅ Buat user dengan readWrite access
✅ Copy connection string:
   mongodb+srv://user:***@cluster.mongodb.net/whatsapp_bot

Collections yang akan dibuat otomatis:
  - verse_pool (1825 ayat)
  - bible_verses (31,102 ayat)
  - scrape_state
  - config
  - wa_auth (WhatsApp auth state)
```

### 2. Telegram Bot Token

```
✅ Buat bot via @BotFather
✅ Copy bot token: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
✅ Catat Telegram user ID (untuk admin)
```

### 3. AI API (Gemini atau Custom)

```
Opsi A: Gemini API (Google AI)
  ✅ Daftar di https://aistudio.google.com/
  ✅ Buat API key
  ✅ Set: GEMINI_API_KEY=your_key

Opsi B: Custom OpenAI-Compatible API
  ✅ Punya endpoint API (misal: neva.jhopanstore.my.id)
  ✅ Set: AI_API_KEY=your_key
  ✅ Set: AI_API_ENDPOINT=https://your-endpoint.com/v1
```

### 4. Webhook (Optional, Recommended)

```
✅ Setup tunnel (ngrok, cloudflare, dll)
✅ Atau pakai Render public URL
✅ Set: WEBHOOK_URL=https://your-domain.com
```

---

## 🔧 Render Setup

### Step 1: Create New Web Service

```
1. Login ke Render Dashboard
2. Klik "New +" → "Web Service"
3. Connect GitHub repository
4. Pilih branch: main
5. Klik "Connect"
```

### Step 2: Configure Build & Deploy

```
Name: whatsapp-bot-renungan
Environment: Node
Region: Singapore (closest to Indonesia)
Branch: main

Build Command:
  pip install -r requirements.txt && npm install

Start Command:
  npm start

Instance Type:
  Free (512 MB RAM) - cukup untuk bot + TTS
```

### Step 3: Environment Variables

Tambahkan SEMUA env variables ini di Render Dashboard → Environment:

```env
# ============================================
# TELEGRAM BOT
# ============================================
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
ADMIN_TELEGRAM_ID=123456789

# ============================================
# WHATSAPP
# ============================================
RENUNGAN_GROUP_ID=6281234567890-1234567890@g.us

# ============================================
# MONGODB
# ============================================
MONGODB_URI=mongodb+srv://user:***@cluster.mongodb.net/whatsapp_bot

# ============================================
# AI PROVIDER (pilih salah satu)
# ============================================
# Opsi A: Gemini
GEMINI_API_KEY=your_gemini_api_key

# Opsi B: Custom API
# AI_API_KEY=your_...
# https://your-endpoint.com/v1

# ============================================
# RENUNGAN SETTINGS
# ============================================
RENUNGAN_TIME=08:00
VERSE_MODE=pool
THEME_PRECOMPUTE_MINUTES=30

# ============================================
# TTS (Text-to-Speech)
# ============================================
TTS_ENABLED=true
TTS_VOICE_FEMALE=id-ID-GadisNeural
TTS_VOICE_MALE=id-ID-ArdiNeural
TTS_VOICE_OVERRIDE=
TTS_RATE=-0%
TTS_PITCH=+0Hz

# ============================================
# WEBHOOK (Optional)
# ============================================
# WEBHOOK_URL=https://your-domain.com
# WEBHOOK_PORT=3000

# ============================================
# TIMEZONE
# ============================================
TIMEZONE=Asia/Makassar
```

### Step 4: Deploy

```
1. Klik "Create Web Service"
2. Tunggu build selesai (~2-3 menit)
   - Render akan install Python
   - Install edge-tts dari requirements.txt
   - Install Node.js dependencies
3. Cek logs: pastikan "✅ Bot started successfully"
4. Scan QR code WhatsApp (via Telegram: /qr)
5. Done! 🎉
```

---

## 🧪 Post-Deployment Testing

### Test 1: Bot Connection

```
✅ Cek Telegram bot: /start
✅ Cek WhatsApp: bot online
✅ Cek logs: "✅ MongoDB connected", "✅ WhatsApp connected"
```

### Test 2: Bible Scrape System

```
✅ Tunggu ~1-2 jam (scraper jalan 1 kitab/jam)
✅ Cek Telegram: /status
   → bible_verses: 31,102 ayat
   → scrape_state: completed
```

### Test 3: Verse Pool

```
✅ Cek Telegram: /versepoolstats
   → Total: 1825 ayat
   → Unused: 1825 ayat
   → Used: 0 ayat
```

### Test 4: Preview Renungan

```
1. Telegram → /menu
2. Klik "📖 Renungan Harian"
3. Klik "👀 Preview Renungan"
4. Tunggu ~15-20 detik
5. Terima:
   📱 Text renungan
   🔊 Voice message (jika TTS_ENABLED=true)
6. Dengarkan audio:
   ✅ Voice rotation (ganjil/genap)
   ✅ Pronunciation jelas
   ✅ Verse reference natural
```

### Test 5: Kirim Renungan

```
1. Dari preview, klik "📤 Kirim Ini"
2. Cek WhatsApp group:
   ✅ Text renungan terkirim
   ✅ Voice message terkirim
3. Cek logs: "✅ Renungan terkirim", "✅ TTS audio generated"
```

---

## 📊 Resource Usage

```
Render Free Tier (512 MB RAM):

Idle (no activity):
  RAM: ~80-100 MB
  CPU: < 1%

Bible scraping (background):
  RAM: ~100-120 MB
  CPU: 5-10%

Renungan generation + TTS:
  RAM: ~150-200 MB
  CPU: 10-20% (selama ~20 detik)

Peak (scraping + renungan + TTS):
  RAM: ~250-300 MB
  CPU: 20-30%

✅ Masih dalam batas free tier!
```

---

## 🔍 Troubleshooting

### Issue 1: TTS tidak jalan

```
❌ Error: "edge-tts: command not found"
✅ Fix: Pastikan build command include "pip install -r requirements.txt"

❌ Error: "TTS generation failed"
✅ Fix: Cek TTS_ENABLED=true di env variables
```

### Issue 2: Bible scraping gagal

```
❌ Error: "Scraping failed: timeout"
✅ Fix: alkitab.mobi mungkin down, tunggu scheduler retry

❌ verse_pool kosong
✅ Fix: Jalankan /rescrapepool di Telegram
```

### Issue 3: AI error

```
❌ Error: "AI rate limit exceeded"
✅ Fix: Tambah GEMINI_API_KEY (comma-separated untuk multiple keys)

❌ Error: "AI generate failed"
✅ Fix: Cek AI_API_KEY atau GEMINI_API_KEY valid
```

### Issue 4: WhatsApp disconnect

```
❌ WhatsApp offline
✅ Fix: Scan ulang QR code via Telegram: /qr

❌ Auth state lost
✅ Fix: Hapus wa_auth collection di MongoDB, scan ulang
```

---

## 📝 Maintenance

### Daily

```
✅ Cek logs: tidak ada error
✅ Cek WhatsApp: bot online
✅ Cek renungan: terkirim jam 08:00
```

### Weekly

```
✅ Cek verse_pool stats: /versepoolstats
✅ Cek bible_verses: /status
✅ Cek MongoDB storage: < 512 MB (free tier)
```

### Monthly

```
✅ Backup MongoDB (export collections)
✅ Cek Render usage: tidak exceed free tier
✅ Update dependencies: git pull, redeploy
```

---

## 🎯 Success Criteria

```
✅ Bot online 24/7
✅ Renungan terkirim setiap hari jam 08:00
✅ Audio TTS terkirim (jika enabled)
✅ Bible scraping selesai (31,102 ayat)
✅ Verse pool terisi (1825 ayat)
✅ No critical errors in logs
```

**Deployment selesai! Bot siap jalan! 🚀✨**
