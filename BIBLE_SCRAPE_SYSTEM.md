# 📖 Bible Verse Scraping & Injection System

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    BOT STARTUP (index.js)                    │
│                                                              │
│  1. Connect MongoDB                                          │
│  2. Load Config                                              │
│  3. Init WhatsApp + Telegram                                 │
│  4. Start Renungan Scheduler                                 │
│  5. Start Bible Scrape Scheduler ← BARU                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  RENUNGAN    │  │  SCRAPE      │  │  BIBLE VERSE DB  │
│  (08:00)     │  │  SCHEDULER   │  │  (MongoDB)       │
│              │  │  (per jam)   │  │                  │
│ 1. Pilih ayat│  │              │  │ 31,102 ayat     │
│ 2. Cek DB ───┼──┼──────────────┼──┤ Collection:      │
│    ├── Ada?  │  │ 1 kitab/jam  │  │ bible_verses    │
│    │   → OK! │  │ PL→PB        │  │                  │
│    └── Tidak?│  │ Pause 07-09  │  │ {ref, text,     │
│        → Scr.│  │ Resume 09+   │  │  pericope, ...} │
│ 3. AI gen ───┼──┼──────────────┼──┤                  │
│    V4 prompt │  │              │  │                  │
│    + verse   │  │              │  │                  │
│ 4. Kirim WA │  │              │  │                  │
└──────────────┘  └──────────────┘  └──────────────────┘
```

## File Baru

### 1. `src/services/verseScraper.js`
Scraper langsung ke alkitab.mobi (TB).

```javascript
scrapeChapter(bookName, chapter)  // Scrape 1 pasal
scrapeBook(bookName, onProgress)  // Scrape seluruh kitab
scrapeVerse(ref)                  // Scrape 1 ayat on-demand
parseVerseRef(ref)                // Parse "Yohanes 3:16" → {book, chapter, verse}

// Data:
BOOK_ABBR    // 66 kitab → singkatan URL
BOOK_CHAPTERS // Jumlah pasal per kitab
ALL_BOOKS    // Urutan: PL (39) → PB (27)
```

### 2. `src/services/bibleVerseDB.js`
MongoDB CRUD untuk 31,102 ayat.

```javascript
// Schema: bible_verses collection
{
  ref: "Yohanes 3:16",              // unique
  text: "Karena begitu besar...",    // teks lengkap TB
  pericope: "Percakapan dengan Nikodemus",
  book: "Yohanes",
  chapter: 3,
  verseStart: 16,
  verseEnd: 16,
  scrapedAt: Date
}

// Functions:
saveVerse(verseData)         // Upsert 1 ayat
saveVersesBulk(verses)       // Bulk upsert (batch 500)
getVerse(ref)                // Ambil 1 ayat by ref
getChapterVerses(book, ch)   // Ambil semua ayat 1 pasal
getBookVerses(book)          // Ambil semua ayat 1 kitab
getTotalVerses()             // Hitung total
getStats()                   // Statistik lengkap
```

### 3. `src/services/bibleScrapeScheduler.js`
Penjadwal scraping otomatis.

```javascript
startScheduler()             // Mulai: 1 kitab/jam
stopScheduler()              // Hentikan
scrapeNow(bookName?)         // Manual trigger
scrapeVerseOnDemand(ref)     // Scraping on-demand (saat renungan)
getStatus()                  // Status scraper

// Jadwal:
// - Setiap jam: scrape 1 kitab
// - Urutan: Kejadian → ... → Wahyu (66 kitab)
// - Pause: 07:00-09:00 (waktu renungan)
// - Resume: 09:00
// - Siklus: ~66 jam (~3 hari dengan pause)
// - State disimpan di MongoDB (survive restart)
```

## File yang Diupdate

### 4. `src/services/aiService.js`
Prompt V4 dengan verse text + pericope injection.

```javascript
// Signature baru:
generateRenungan(verseRef, specialDay, verseData)
//                                      ↑ BARU: {text, pericope}

// Ketika verseData ada:
//   → System message + user message
//   → Ayat sudah disediakan (AI tidak perlu ingat)
//   → Perikop sebagai konteks tema
//   → max_tokens: 2048
//
// Ketika verseData null:
//   → Prompt lama (AI harus ingat ayat sendiri)
//   → max_tokens: 1536
```

### 5. `src/renunganHandler.js`
Verse inject saat generate renungan.

```javascript
// Alur baru saat renungan:
// 1. Pilih ayat (pool/yearly)
// 2. Cek MongoDB → ada teks ayat?
//    ├── Ya → gunakan
//    └── Tidak → scrape on-demand → simpan ke DB
// 3. generateRenungan(verseRef, specialDay, verseData)
// 4. Kirim ke WhatsApp
```

### 6. `src/index.js`
Start scraper scheduler saat bot boot.

```javascript
// Step 4 (BARU): Start Bible Scrape Scheduler
if (mongoService.isConnected()) {
  bibleScrapeScheduler.startScheduler();
}

// Graceful shutdown:
bibleScrapeScheduler.stopScheduler();
```

## Estimasi Storage

```
Total ayat Alkitab TB:    31,102
Avg per ayat:             ~325 bytes
Total raw:                ~9.6 MB
Dengan MongoDB overhead:  ~14.5 MB
Free tier 512 MB:         AMAN! (pakai 2.8%)
```

## Estimasi Waktu Scraping

```
Total pasal:       1,189
Delay per pasal:   500ms
Total scraping:    ~10 menit (non-stop)

Jadwal 1 kitab/jam:
  66 kitab ÷ 22 jam aktif/hari = ~3 hari per siklus
  (24 jam - 2 jam pause = 22 jam aktif)
```

## Alur Lengkap Saat Renungan (08:00)

```
08:00 → sendRenungan() dipanggil
  │
  ├── 1. getVerseForToday() → dapat verseRef
  │
  ├── 2. Cek MongoDB: bibleVerseDB.getVerse(verseRef)
  │     │
  │     ├── HIT → verseData = {text, pericope}
  │     │         Log: "✅ Verse text ditemukan di DB"
  │     │
  │     └── MISS → bibleScraper.scrapeVerseOnDemand(verseRef)
  │                ├── Fetch dari alkitab.mobi
  │                ├── Parse HTML
  │                ├── Simpan ke DB
  │                └── Log: "✅ Disimpan ke DB"
  │
  ├── 3. generateRenungan(verseRef, specialDay, verseData)
  │     │
  │     ├── verseData ada? → V4 Prompt (system + user message)
  │     │     → AI fokus menulis renungan
  │     │     → Ayat akurat, perikop sebagai konteks
  │     │
  │     └── verseData null? → Prompt lama (single user message)
  │           → AI harus ingat ayat sendiri (fallback)
  │
  ├── 4. Kirim ke WhatsApp
  │
  └── 5. Mark verses as used
```

## Alur Scraper Scheduler (tiap jam)

```
Setiap jam → scrapeNextBook()
  │
  ├── Cek: jam 07:00-09:00?
  │     ├── Ya → PAUSE (log: "waktu renungan")
  │     └── Tidak → lanjut
  │
  ├── Load state dari MongoDB
  │     └── { currentIndex, cycle, lastBook, ... }
  │
  ├── Ambil kitab berikutnya dari ALL_BOOKS
  │     └── e.g., "Kejadian" (50 pasal)
  │
  ├── Scrape semua pasal kitab tersebut
  │     ├── Pasal 1: fetch → parse → delay 500ms
  │     ├── Pasal 2: fetch → parse → delay 500ms
  │     ├── ...
  │     └── Pasal 50: fetch → parse
  │
  ├── Simpan ke MongoDB (bulk upsert, timpa lama)
  │     └── saveVersesBulk(docs)
  │
  ├── Update state
  │     └── currentIndex++, lastBook, lastScrapedAt
  │
  └── Log progress
        └── "50/66 (75.8%) | 1234/31102 ayat | Siklus #1"
```

## Prompt V4 vs Lama

```
SEBELUM (Prompt Lama):
  messages: [{ role: "user", content: "Ayat: Yohanes 3:16 ..." }]
  → AI harus ingat teks ayat sendiri
  → Sering hallucinate (flash-lite)
  → Paragraf generic

SESUDAH (Prompt V4):
  messages: [
    { role: "system", content: "Kamu kakak rohani..." },
    { role: "user", content: "Teks: [ayat asli] + Perikop: [...] + ..." }
  ]
  → AI fokus menulis renungan
  → Ayat PASTI akurat (dari cache)
  → Paragraf context-aware
  → Bahasa sederhana, tidak ada label
```
