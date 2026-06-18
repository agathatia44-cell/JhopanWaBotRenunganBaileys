/**
 * bibleScrapeScheduler.js — Penjadwal scraping Alkitab per kitab per jam
 *
 * Alur:
 * 1. Bot startup → mulai scraping 1 kitab/jam
 * 2. Setiap jam → scrape kitab berikutnya (PL dulu, baru PB)
 * 3. Jam 07:00-09:00 → PAUSE (waktu renungan di jam 08:00)
 * 4. Jam 09:00 → RESUME scraping
 * 5. Setelah 66 kitab selesai → mulai siklus baru
 *
 * State disimpan di MongoDB agar survive restart
 */

const verseScraper = require('./verseScraper');
const bibleVerseDB = require('./bibleVerseDB');
const mongoService = require('./mongoService');
const moment = require('moment-timezone');

const { ALL_BOOKS, BOOK_CHAPTERS } = verseScraper;

// Waktu pause untuk renungan (WITA/Asia/Makassar)
const PAUSE_HOUR_START = 7;   // 07:00
const PAUSE_HOUR_END = 9;     // 09:00

let scrapeTimer = null;
let startupTimer = null;  // Bug #2 fix: store initial setTimeout
let isRunning = false;
let currentState = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Bangun ayat-ayat dari hasil scraping kitab
 * Format: { ref, text, pericope, book, chapter, verseStart, verseEnd }
 */
function buildVerseDocs(scrapeResult) {
  const { book, verses } = scrapeResult;
  const docs = [];

  // Group by chapter + pericope untuk membangun ref per ayat
  for (const v of verses) {
    const ref = `${book} ${v.chapter}:${v.verse}`;
    docs.push({
      ref,
      text: v.text,
      pericope: v.pericope,
      book: v.book,
      chapter: v.chapter,
      verseStart: v.verse,
      verseEnd: v.verse,
    });
  }

  return docs;
}

/**
 * Scraping satu kitab + simpan ke MongoDB
 */
async function scrapeAndSaveBook(bookName) {
  console.log(`\n📖 [Scraper] Mulai scraping: ${bookName} (${BOOK_CHAPTERS[bookName]} pasal)`);
  const startTime = Date.now();

  const result = await verseScraper.scrapeBook(bookName, (current, total, verseCount) => {
    if (current % 10 === 0 || current === total) {
      console.log(`   📄 ${bookName} ${current}/${total} pasal (${verseCount} ayat)`);
    }
  });

  // ===== LAYER 2: Retry pasal yang gagal (dengan delay lebih lama) =====
  if (result.failedChapters && result.failedChapters.length > 0) {
    console.log(`\n   🔄 [Layer 2] Retry ${result.failedChapters.length} pasal gagal: ${result.failedChapters.join(', ')}`);
    await sleep(5000); // Tunggu 5 detik sebelum retry batch

    for (const ch of result.failedChapters) {
      try {
        await sleep(3000); // Delay 3s antar retry
        const verses = await verseScraper.scrapeChapter(bookName, ch);
        verses.forEach(v => {
          result.verses.push({
            book: bookName,
            chapter: ch,
            verse: v.verse,
            text: v.text,
            pericope: v.pericope,
          });
        });
        result.totalVerses += verses.length;
        console.log(`   ✅ ${bookName} ${ch}: berhasil di-retry (${verses.length} ayat)`);
      } catch (err) {
        console.log(`   ❌ ${bookName} ${ch}: retry Layer 2 gagal - ${err.message}`);
      }
    }

    // Update failedChapters — hapus yang berhasil di-retry
    const retriedChapters = result.failedChapters.filter(ch =>
      !result.verses.some(v => v.chapter === ch)
    );
    result.failedChapters = retriedChapters;

    if (retriedChapters.length > 0) {
      console.log(`   ⚠️  Masih ${retriedChapters.length} pasal gagal: ${retriedChapters.join(', ')}`);
    } else {
      console.log(`   ✅ Semua pasal berhasil setelah retry!`);
    }
  }

  // Build docs dari hasil scraping
  const docs = buildVerseDocs(result);

  // Simpan ke MongoDB (bulk upsert — timpa yang lama)
  const saveResult = await bibleVerseDB.saveVersesBulk(docs);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   ✅ ${bookName} selesai!`);
  console.log(`      ${result.totalVerses} ayat di-scrape`);
  console.log(`      ${saveResult.totalUpserted} baru, ${saveResult.totalModified} diupdate`);
  console.log(`      Waktu: ${elapsed} detik`);

  return {
    book: bookName,
    totalVerses: result.totalVerses,
    upserted: saveResult.totalUpserted,
    updated: saveResult.totalModified,
    failedChapters: result.failedChapters || [],
    elapsed: parseFloat(elapsed),
  };
}

/**
 * Load state dari MongoDB
 */
async function loadState() {
  if (!mongoService.isConnected()) return getDefaultState();

  const db = mongoService.getDb();
  const collection = db.collection('scrape_state');
  const state = await collection.findOne({ _id: 'bible_scrape_progress' });

  if (state) return state;
  return getDefaultState();
}

/**
 * Save state ke MongoDB
 */
async function saveState(state) {
  if (!mongoService.isConnected()) return;

  const db = mongoService.getDb();
  const collection = db.collection('scrape_state');
  await collection.updateOne(
    { _id: 'bible_scrape_progress' },
    { $set: { ...state, updatedAt: new Date() } },
    { upsert: true }
  );
}

function getDefaultState() {
  return {
    _id: 'bible_scrape_progress',
    currentIndex: 0,          // Index kitab saat ini di ALL_BOOKS
    cycle: 1,                 // Siklus ke-berapa
    totalScraped: 0,          // Total kitab yang sudah di-scrape
    lastBook: null,           // Kitab terakhir yang di-scrape
    lastScrapedAt: null,      // Timestamp terakhir scrape
    paused: false,            // Apakah sedang pause
  };
}

/**
 * Cek apakah sekarang waktu pause (07:00 - 09:00 WITA)
 */
function isPauseTime() {
  const witaHour = moment().tz('Asia/Makassar').hour();
  return witaHour >= PAUSE_HOUR_START && witaHour < PAUSE_HOUR_END;
}

/**
 * Layer 3: Final verification — scan semua kitab, cari pasal yang missing, scrape ulang
 * Dipanggil setelah siklus scraping selesai
 */
async function runFinalVerification() {
  console.log('\n🔍 [Layer 3] Verifikasi Final — mengecek pasal yang missing...');

  const missing = await bibleVerseDB.getMissingChapters(BOOK_CHAPTERS);

  if (missing.length === 0) {
    const totalInDB = await bibleVerseDB.getTotalVerses();
    console.log(`   ✅ SEMPURNA! Semua pasal berhasil di-scrape.`);
    console.log(`   📊 Total ayat di DB: ${totalInDB.toLocaleString()}`);
    return;
  }

  console.log(`   ⚠️  Ditemukan ${missing.length} pasal yang missing:`);
  missing.forEach(m => console.log(`      - ${m.book} pasal ${m.chapter}`));
  console.log(`   🔄 Mulai scrape ulang pasal yang missing...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const { book, chapter } of missing) {
    try {
      await sleep(2000); // Delay 2s antar request
      const verses = await verseScraper.scrapeChapter(book, chapter);

      if (verses.length > 0) {
        // Build docs dan simpan
        const docs = verses.map(v => ({
          ref: `${book} ${chapter}:${v.verse}`,
          text: v.text,
          pericope: v.pericope,
          book,
          chapter,
          verseStart: v.verse,
          verseEnd: v.verse,
        }));
        await bibleVerseDB.saveVersesBulk(docs);
        successCount++;
        console.log(`   ✅ ${book} ${chapter}: ${verses.length} ayat berhasil`);
      } else {
        failCount++;
        console.log(`   ⚠️  ${book} ${chapter}: 0 ayat (halaman kosong?)`);
      }
    } catch (err) {
      failCount++;
      console.log(`   ❌ ${book} ${chapter}: ${err.message}`);
    }
  }

  const totalInDB = await bibleVerseDB.getTotalVerses();
  console.log(`\n   📊 Hasil verifikasi:`);
  console.log(`      ✅ ${successCount} pasal berhasil di-scrape ulang`);
  console.log(`      ❌ ${failCount} pasal masih gagal`);
  console.log(`      📊 Total ayat di DB: ${totalInDB.toLocaleString()}`);

  // Kalau masih ada yang gagal, coba 1x lagi dengan delay lebih lama
  if (failCount > 0) {
    console.log(`\n   🔄 Retry terakhir untuk ${failCount} pasal yang masih gagal...`);
    await sleep(10000); // Tunggu 10 detik

    const stillMissing = await bibleVerseDB.getMissingChapters(BOOK_CHAPTERS);
    let finalSuccess = 0;

    for (const { book, chapter } of stillMissing) {
      try {
        await sleep(5000); // Delay 5s
        const verses = await verseScraper.scrapeChapter(book, chapter);
        if (verses.length > 0) {
          const docs = verses.map(v => ({
            ref: `${book} ${chapter}:${v.verse}`,
            text: v.text,
            pericope: v.pericope,
            book,
            chapter,
            verseStart: v.verse,
            verseEnd: v.verse,
          }));
          await bibleVerseDB.saveVersesBulk(docs);
          finalSuccess++;
          console.log(`   ✅ ${book} ${chapter}: berhasil di retry final`);
        }
      } catch (err) {
        console.log(`   ❌ ${book} ${chapter}: tetap gagal - ${err.message}`);
      }
    }

    const finalTotal = await bibleVerseDB.getTotalVerses();
    const finalMissing = await bibleVerseDB.getMissingChapters(BOOK_CHAPTERS);
    console.log(`\n   📊 HASIL AKHIR:`);
    console.log(`      Total ayat: ${finalTotal.toLocaleString()}`);
    console.log(`      Pasal missing: ${finalMissing.length}`);
    if (finalMissing.length > 0) {
      console.log(`      ⚠️  Pasal berikut akan di-scrape on-demand saat renungan:`);
      finalMissing.forEach(m => console.log(`         - ${m.book} pasal ${m.chapter}`));
    } else {
      console.log(`      ✅ 100% LENGKAP! Semua pasal berhasil!`);
    }
  }
}

/**
 * Jalankan scraping untuk kitab berikutnya
 */
async function scrapeNextBook() {
  if (isRunning) return;
  isRunning = true;  // Bug #4 fix: set IMMEDIATELY before any await

  try {
    // Cek waktu pause
    if (isPauseTime()) {
      if (!currentState?.paused) {
        console.log('⏸️  [Scraper] Pause — waktu renungan (07:00-09:00)');
        if (currentState) {
          try {
            currentState.paused = true;
            await saveState(currentState);
          } catch (e) {
            console.log(`   ⚠️  Gagal save pause state: ${e.message}`);
          }
        }
      }
      isRunning = false;
      return;
    }

    // Resume dari pause
    if (currentState?.paused) {
      console.log('▶️  [Scraper] Resume setelah pause renungan');
      try {
        currentState.paused = false;
        await saveState(currentState);
      } catch (e) {
        console.log(`   ⚠️  Gagal save resume state: ${e.message}`);
      }
    }

    if (!currentState) {
      currentState = await loadState();
    }

    const bookName = ALL_BOOKS[currentState.currentIndex];
    if (!bookName) {
      // Siklus selesai — jalankan verifikasi final sebelum STOP
      console.log(`\n🎉 [Scraper] Siklus #${currentState.cycle} selesai!`);
      await runFinalVerification();

      console.log(`   📖 Alkitab TB sudah lengkap di database. Scraping terjadwal dihentikan.`);
      console.log(`   🔍 Scraping on-demand (saat renungan) tetap aktif untuk ayat yang belum ada.`);
      currentState.paused = true;
      currentState.lastBook = ALL_BOOKS[ALL_BOOKS.length - 1]; // kitab terakhir
      currentState.lastScrapedAt = new Date();
      await saveState(currentState);
      stopScheduler();
      return;
    }

    console.log(`\n🕐 [Scraper] Jam scraping: ${bookName} (kitab ${currentState.currentIndex + 1}/${ALL_BOOKS.length})`);

    const result = await scrapeAndSaveBook(bookName);

    // Update state
    currentState.currentIndex++;
    currentState.totalScraped++;
    currentState.lastBook = bookName;
    currentState.lastScrapedAt = new Date();
    await saveState(currentState);

    // Log progress
    const totalBooks = ALL_BOOKS.length;
    const progress = ((currentState.currentIndex / totalBooks) * 100).toFixed(1);
    const totalInDB = await bibleVerseDB.getTotalVerses();
    console.log(`   📊 Progress: ${currentState.currentIndex}/${totalBooks} (${progress}%)`);
    console.log(`   📊 Total ayat di DB: ${totalInDB.toLocaleString()}/31,102`);
    console.log(`   📊 Siklus: #${currentState.cycle}`);

  } catch (err) {
    console.error(`❌ [Scraper] Error: ${err.message}`);
    // Jangan increment index — retry kitab yang sama di jam berikutnya
  } finally {
    isRunning = false;
  }
}

/**
 * Mulai scheduler — scraping 1 kitab per jam
 */
async function startScheduler() {
  if (scrapeTimer || startupTimer) {
    console.log('⚠️  [Scraper] Scheduler sudah berjalan');
    return;
  }

  // Cek apakah scraping sudah selesai (siklus #1 complete)
  const state = await loadState();
  if (state && state.lastBook === ALL_BOOKS[ALL_BOOKS.length - 1] && state.paused) {
    const totalInDB = mongoService.isConnected()
      ? await (require('./bibleVerseDB')).getTotalVerses()
      : 0;
    console.log('\n📖 [Scraper] Alkitab TB sudah lengkap di database!');
    console.log(`   Total ayat: ${totalInDB.toLocaleString()}`);
    console.log(`   Scraping terjadwal tidak diperlukan lagi.`);
    console.log(`   🔍 Scraping on-demand tetap aktif (untuk ayat yang belum ada).`);
    currentState = state;
    return; // Jangan start scheduler
  }

  console.log('\n🕐 [Scraper] Memulai Bible Scrape Scheduler');
  console.log(`   Mode: 1 kitab/jam (${ALL_BOOKS.length} kitab)`);
  console.log(`   Pause: ${PAUSE_HOUR_START}:00 - ${PAUSE_HOUR_END}:00 (waktu renungan)`);
  console.log(`   Target: 1 siklus selesai lalu STOP (TB tidak berubah)`);
  if (state && state.currentIndex > 0) {
    console.log(`   Resume dari: ${ALL_BOOKS[state.currentIndex]} (kitab ${state.currentIndex + 1}/${ALL_BOOKS.length})`);
  }
  console.log(`   Estimasi: ~${Math.ceil(ALL_BOOKS.length / 22)} hari (${ALL_BOOKS.length} kitab, 22 jam aktif/hari)`);

  currentState = state;

  // Jalankan pertama kali setelah 1 menit (biar bot settle dulu)
  startupTimer = setTimeout(() => {
    startupTimer = null; // Clear reference after firing
    scrapeNextBook();

    // Kemudian setiap jam (di menit ke-0)
    scrapeTimer = setInterval(() => {
      scrapeNextBook();
    }, 60 * 60 * 1000); // 1 jam
  }, 60 * 1000);
}

/**
 * Hentikan scheduler
 */
function stopScheduler() {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (scrapeTimer) {
    clearInterval(scrapeTimer);
    scrapeTimer = null;
  }
  isRunning = false;
  currentState = null;
  console.log('⏹️  [Scraper] Scheduler dihentikan');
}

/**
 * Jalankan scraping SEKARANG juga (manual trigger)
 */
async function scrapeNow(bookName) {
  if (bookName) {
    return scrapeAndSaveBook(bookName);
  }
  // Kalau tidak spesifik, scrape kitab berikutnya
  return scrapeNextBook();
}

/**
 * Scraping on-demand untuk 1 ayat (saat renungan)
 * Dipanggil jika ayat belum ada di database
 */
async function scrapeVerseOnDemand(ref) {
  console.log(`🔍 [Scraper] Ayat belum ada di DB, scraping on-demand: ${ref}`);

  try {
    const verseData = await verseScraper.scrapeVerse(ref);

    // Simpan ke DB
    await bibleVerseDB.saveVerse(verseData);
    console.log(`   ✅ ${ref} disimpan ke DB`);

    return verseData;
  } catch (err) {
    console.error(`   ❌ Gagal scraping ${ref}: ${err.message}`);
    return null;
  }
}

/**
 * Dapatkan status scraper
 */
async function getStatus() {
  const state = currentState || await loadState();
  const totalInDB = mongoService.isConnected() ? await bibleVerseDB.getTotalVerses() : 0;

  return {
    running: !!scrapeTimer,
    isRunning: isRunning,
    paused: state?.paused || false,
    pauseWindow: `${PAUSE_HOUR_START}:00 - ${PAUSE_HOUR_END}:00`,
    isPauseNow: isPauseTime(),
    currentBook: state?.currentIndex != null ? ALL_BOOKS[state.currentIndex] : null,
    currentIndex: state?.currentIndex || 0,
    totalBooks: ALL_BOOKS.length,
    cycle: state?.cycle || 1,
    totalScraped: state?.totalScraped || 0,
    lastBook: state?.lastBook || null,
    lastScrapedAt: state?.lastScrapedAt || null,
    versesInDB: totalInDB,
    totalBibleVerses: 31102,
    progress: `${((state?.currentIndex || 0) / ALL_BOOKS.length * 100).toFixed(1)}%`,
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  scrapeNow,
  scrapeVerseOnDemand,
  getStatus,
  scrapeAndSaveBook,
  isPauseTime,
};
