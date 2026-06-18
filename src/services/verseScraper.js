/**
 * verseScraper.js — Scraping ayat Alkitab dari alkitab.mobi (TB)
 * Sumber: Yayasan Lembaga SABDA (alkitab.mobi)
 */

const https = require('https');
const http = require('http');

// ===== MAPPING: Nama Kitab → Singkatan URL alkitab.mobi =====
const BOOK_ABBR = {
  'Kejadian': 'Kej', 'Keluaran': 'Kel', 'Imamat': 'Ima', 'Bilangan': 'Bil',
  'Ulangan': 'Ula', 'Yosua': 'Yos', 'Hakim-hakim': 'Hak', 'Rut': 'Rut',
  '1 Samuel': '1Sa', '2 Samuel': '2Sa', '1 Raja-raja': '1Ra', '2 Raja-raja': '2Ra',
  '1 Tawarikh': '1Ta', '2 Tawarikh': '2Ta', 'Ezra': 'Ezr', 'Nehemia': 'Neh',
  'Ester': 'Est', 'Ayub': 'Ayb', 'Mazmur': 'Mzm', 'Amsal': 'Ams',
  'Pengkhotbah': 'Pkh', 'Kidung Agung': 'Kid', 'Yesaya': 'Yes', 'Yeremia': 'Yer',
  'Ratapan': 'Rat', 'Yehezkiel': 'Yeh', 'Daniel': 'Dan', 'Hosea': 'Hos',
  'Yoel': 'Yoe', 'Amos': 'Amo', 'Obaja': 'Oba', 'Yunus': 'Yun',
  'Mikha': 'Mik', 'Nahum': 'Nah', 'Habakuk': 'Hab', 'Zefanya': 'Zef',
  'Hagai': 'Hag', 'Zakharia': 'Zak', 'Maleakhi': 'Mal',
  'Matius': 'Mat', 'Markus': 'Mrk', 'Lukas': 'Luk', 'Yohanes': 'Yoh',
  'Kisah Para Rasul': 'Kis', 'Roma': 'Rom',
  '1 Korintus': '1Ko', '2 Korintus': '2Ko', 'Galatia': 'Gal', 'Efesus': 'Efe',
  'Filipi': 'Flp', 'Kolose': 'Kol', '1 Tesalonika': '1Te', '2 Tesalonika': '2Te',
  '1 Timotius': '1Ti', '2 Timotius': '2Ti', 'Titus': 'Tit', 'Filemon': 'Flm',
  'Ibrani': 'Ibr', 'Yakobus': 'Yak', '1 Petrus': '1Pt', '2 Petrus': '2Pt',
  '1 Yohanes': '1Yo', '2 Yohanes': '2Yo', '3 Yohanes': '3Yo',
  'Yudas': 'Yud', 'Wahyu': 'Why',
};

// Jumlah pasal per kitab
const BOOK_CHAPTERS = {
  'Kejadian':50,'Keluaran':40,'Imamat':27,'Bilangan':36,'Ulangan':34,
  'Yosua':24,'Hakim-hakim':21,'Rut':4,'1 Samuel':31,'2 Samuel':24,
  '1 Raja-raja':22,'2 Raja-raja':25,'1 Tawarikh':29,'2 Tawarikh':36,
  'Ezra':10,'Nehemia':13,'Ester':10,'Ayub':42,'Mazmur':150,
  'Amsal':31,'Pengkhotbah':12,'Kidung Agung':8,'Yesaya':66,'Yeremia':52,
  'Ratapan':5,'Yehezkiel':48,'Daniel':12,'Hosea':14,'Yoel':3,
  'Amos':9,'Obaja':1,'Yunus':4,'Mikha':7,'Nahum':3,
  'Habakuk':3,'Zefanya':3,'Hagai':2,'Zakharia':14,'Maleakhi':4,
  'Matius':28,'Markus':16,'Lukas':24,'Yohanes':21,'Kisah Para Rasul':28,
  'Roma':16,'1 Korintus':16,'2 Korintus':13,'Galatia':6,'Efesus':6,
  'Filipi':4,'Kolose':4,'1 Tesalonika':5,'2 Tesalonika':3,'1 Timotius':6,
  '2 Timotius':4,'Titus':3,'Filemon':1,'Ibrani':13,'Yakobus':5,
  '1 Petrus':5,'2 Petrus':3,'1 Yohanes':5,'2 Yohanes':1,'3 Yohanes':1,
  'Yudas':1,'Wahyu':22,
};

// Urutan kitab (PL lalu PB)
const ALL_BOOKS = [
  'Kejadian','Keluaran','Imamat','Bilangan','Ulangan','Yosua','Hakim-hakim','Rut',
  '1 Samuel','2 Samuel','1 Raja-raja','2 Raja-raja','1 Tawarikh','2 Tawarikh',
  'Ezra','Nehemia','Ester','Ayub','Mazmur','Amsal','Pengkhotbah','Kidung Agung',
  'Yesaya','Yeremia','Ratapan','Yehezkiel','Daniel','Hosea','Yoel','Amos',
  'Obaja','Yunus','Mikha','Nahum','Habakuk','Zefanya','Hagai','Zakharia','Maleakhi',
  'Matius','Markus','Lukas','Yohanes','Kisah Para Rasul','Roma',
  '1 Korintus','2 Korintus','Galatia','Efesus','Filipi','Kolose',
  '1 Tesalonika','2 Tesalonika','1 Timotius','2 Timotius','Titus','Filemon',
  'Ibrani','Yakobus','1 Petrus','2 Petrus','1 Yohanes','2 Yohanes','3 Yohanes',
  'Yudas','Wahyu',
];

const PL_BOOKS = ALL_BOOKS.slice(0, 39);
const PB_BOOKS = ALL_BOOKS.slice(39);

/**
 * Fetch URL dengan timeout dan retry
 */
function fetchUrl(url, timeout = 15000, maxRedirects = 5, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BibleBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, (res) => {
      // Handle redirect (with depth limit)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); // Drain response to free socket
        if (redirectCount >= maxRedirects) {
          reject(new Error(`Too many redirects (max ${maxRedirects})`));
          return;
        }
        fetchUrl(res.headers.location, timeout, maxRedirects, redirectCount + 1)
          .then(resolve).catch(reject);
        return;
      }

      // Validate status code
      if (res.statusCode !== 200) {
        res.resume(); // Drain response
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
  });
}

/**
 * Parse HTML dari alkitab.mobi → array ayat
 * @returns {Array<{verse: number, text: string, pericope: string|null}>}
 */
function parseChapterHtml(html) {
  const verses = [];
  let currentPericope = null;
  const paragraphs = html.split(/<p[\s>]/i).slice(1);  // Case-insensitive split

  for (const p of paragraphs) {
    // Cek perikop
    const pericopeMatch = p.match(/class="paragraphtitle">(.*?)<\/span>/);
    if (pericopeMatch) {
      currentPericope = pericopeMatch[1].trim();
      continue;
    }

    // Cek ayat: <a name=v16> + <span data-begin="...">content</span>
    // Use [\s\S] instead of . to match across newlines
    const verseMatch = p.match(/name=v(\d+)[\s\S]*?<span[^>]*data-begin[^>]*>([\s\S]*?)<\/span>/);
    if (verseMatch) {
      const verseNum = parseInt(verseMatch[1]);
      const content = verseMatch[2]
        .replace(/<[^>]+>/g, '')   // hapus HTML tags
        .replace(/\s+/g, ' ')       // normalisasi whitespace
        .trim();

      if (content && content.length > 0) {  // Allow short verses (e.g., "Ya.", "Amin.")
        verses.push({
          verse: verseNum,
          text: content,
          pericope: currentPericope,
        });
      }
    }
  }

  return verses;
}

/**
 * Scraping 1 pasal dari alkitab.mobi
 * @param {string} bookName - Nama kitab (e.g., "Yohanes")
 * @param {number} chapter - Nomor pasal
 * @returns {Promise<Array<{verse, text, pericope}>>}
 */
async function scrapeChapter(bookName, chapter) {
  const abbr = BOOK_ABBR[bookName];
  if (!abbr) throw new Error(`Kitab tidak ditemukan: ${bookName}`);

  const url = `https://alkitab.mobi/tb/${abbr}/${chapter}/`;
  const html = await fetchUrl(url);
  return parseChapterHtml(html);
}

/**
 * Scraping seluruh kitab (semua pasal)
 * @param {string} bookName - Nama kitab
 * @param {Function} onProgress - Callback(current, total, verses)
 * @returns {Promise<{book, chapters, totalVerses, verses: Array}>}
 */
async function scrapeBook(bookName, onProgress = null) {
  const totalChapters = BOOK_CHAPTERS[bookName];
  if (!totalChapters) throw new Error(`Kitab tidak ditemukan: ${bookName}`);

  const allVerses = [];
  const failedChapters = [];

  for (let ch = 1; ch <= totalChapters; ch++) {
    let success = false;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const verses = await scrapeChapter(bookName, ch);
        verses.forEach(v => {
          allVerses.push({
            book: bookName,
            chapter: ch,
            verse: v.verse,
            text: v.text,
            pericope: v.pericope,
          });
        });

        if (onProgress) onProgress(ch, totalChapters, verses.length);
        success = true;
        break;
      } catch (err) {
        if (attempt < maxRetries) {
          const delay = 2000 * attempt; // 2s, 4s, 6s
          console.log(`   ⚠️  ${bookName} ${ch}: ${err.message} (retry ${attempt}/${maxRetries} dalam ${delay/1000}s)`);
          await sleep(delay);
        } else {
          console.log(`   ❌ ${bookName} ${ch}: semua ${maxRetries} retry gagal - ${err.message}`);
          failedChapters.push(ch);
        }
      }
    }

    // Delay 500ms antar pasal agar tidak di-sangka bot
    if (success && ch < totalChapters) await sleep(500);
  }

  return {
    book: bookName,
    chapters: totalChapters,
    totalVerses: allVerses.length,
    verses: allVerses,
    failedChapters,  // Pasal yang gagal setelah semua retry
  };
}

/**
 * Scraping satu ayat spesifik (on-demand)
 * @param {string} ref - Format: "Yohanes 3:16" atau "Roma 8:28-30"
 * @returns {Promise<{ref, text, pericope, book, chapter, verseStart, verseEnd}>}
 */
async function scrapeVerse(ref) {
  const parsed = parseVerseRef(ref);
  if (!parsed) throw new Error(`Format ref tidak valid: ${ref}`);

  const verses = await scrapeChapter(parsed.book, parsed.chapter);
  const range = verses.filter(v =>
    v.verse >= parsed.verseStart && v.verse <= parsed.verseEnd
  );

  if (range.length === 0) {
    throw new Error(`Ayat tidak ditemukan: ${ref}`);
  }

  // Gabungkan teks untuk multi-ayat
  const combinedText = range.length === 1
    ? range[0].text
    : range.map(v => `${v.verse}. ${v.text}`).join(' ');

  return {
    ref,
    text: combinedText,
    pericope: range[0].pericope,
    book: parsed.book,
    chapter: parsed.chapter,
    verseStart: parsed.verseStart,
    verseEnd: parsed.verseEnd,
  };
}

/**
 * Parse referensi ayat
 * @param {string} ref - "Yohanes 3:16" atau "Roma 8:28-30"
 * @returns {{book, chapter, verseStart, verseEnd}|null}
 */
function parseVerseRef(ref) {
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  return {
    book: match[1],
    chapter: parseInt(match[2]),
    verseStart: parseInt(match[3]),
    verseEnd: match[4] ? parseInt(match[4]) : parseInt(match[3]),
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  scrapeChapter,
  scrapeBook,
  scrapeVerse,
  parseVerseRef,
  BOOK_ABBR,
  BOOK_CHAPTERS,
  ALL_BOOKS,
  PL_BOOKS,
  PB_BOOKS,
};
