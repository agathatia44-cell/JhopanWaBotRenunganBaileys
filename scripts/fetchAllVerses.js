require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

// ===== BOOK NAME → URL ABBREVIATION MAPPING =====
const BOOK_MAP = {
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
  // Aliases
  'Mikah': 'Mik',
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
  });
}

function parseChapter(html) {
  const verses = [];
  let currentPericope = null;
  const paragraphs = html.split('<p>').slice(1);
  
  for (const p of paragraphs) {
    const pericopeMatch = p.match(/class="paragraphtitle">(.*?)<\/span>/);
    if (pericopeMatch) {
      currentPericope = pericopeMatch[1].trim();
      continue;
    }
    const verseMatch = p.match(/name=v(\d+).*?<span[^>]*data-begin[^>]*>(.*?)<\/span>/);
    if (verseMatch) {
      const verseNum = parseInt(verseMatch[1]);
      const content = verseMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (content && content.length > 2) {
        verses.push({ verse: verseNum, text: content, pericope: currentPericope });
      }
    }
  }
  return verses;
}

function parseVerseRef(ref) {
  // Handle: "Yohanes 3:16", "1 Korintus 13:4-7", "Mazmur 23:1-3"
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  return {
    book: match[1],
    chapter: parseInt(match[2]),
    verseStart: parseInt(match[3]),
    verseEnd: match[4] ? parseInt(match[4]) : parseInt(match[3])
  };
}

function sleep(ms) { return new Promise(ok => setTimeout(ok, ms)); }

(async () => {
  // 1. Collect all verse references
  console.log('📖 Mengumpulkan referensi ayat...');
  const allRefs = [];
  for (let y = 2026; y <= 2030; y++) {
    const data = require(path.join(__dirname, '..', 'src', 'data', `verses_${y}.json`));
    data.verses.forEach(v => allRefs.push(v.verse));
  }
  const uniqueRefs = [...new Set(allRefs)];
  console.log(`   Total: ${uniqueRefs.length} ayat unik`);

  // 2. Group by book+chapter
  const chapterGroups = {};
  uniqueRefs.forEach(ref => {
    const parsed = parseVerseRef(ref);
    if (!parsed) { console.log('   ⚠️ Skip: ' + ref); return; }
    const key = `${parsed.book} ${parsed.chapter}`;
    if (!chapterGroups[key]) chapterGroups[key] = { ...parsed, refs: [] };
    chapterGroups[key].refs.push(parsed);
  });
  const chapterKeys = Object.keys(chapterGroups).sort();
  console.log(`   Pasal unik: ${chapterKeys.length}`);

  // 3. Scrape all chapters
  console.log('\n🕷️  Mulai scraping alkitab.mobi...\n');
  const cache = {}; // { "Yohanes 3": [{ verse, text, pericope }] }
  let success = 0, failed = 0;

  for (let i = 0; i < chapterKeys.length; i++) {
    const key = chapterKeys[i];
    const info = chapterGroups[key];
    const abbr = BOOK_MAP[info.book];
    
    if (!abbr) {
      console.log(`   ❌ [${i+1}/${chapterKeys.length}] ${key} — abbreviation not found`);
      failed++;
      continue;
    }

    const url = `https://alkitab.mobi/tb/${abbr}/${info.chapter}/`;
    process.stdout.write(`   [${i+1}/${chapterKeys.length}] ${key} ... `);

    try {
      const html = await fetch(url);
      const verses = parseChapter(html);
      cache[key] = verses;
      success++;
      console.log(`✅ ${verses.length} ayat`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }

    // Jeda 500ms agar tidak spam server
    if (i < chapterKeys.length - 1) await sleep(500);
  }

  console.log(`\n✅ Selesai! Success: ${success}, Failed: ${failed}`);

  // 4. Build verse lookup: ref → { text, pericope }
  console.log('\n📦 Membangun verse lookup...');
  const verseLookup = {};
  let matched = 0, unmatched = 0;

  uniqueRefs.forEach(ref => {
    const parsed = parseVerseRef(ref);
    if (!parsed) return;
    
    const key = `${parsed.book} ${parsed.chapter}`;
    const chapterVerses = cache[key];
    if (!chapterVerses) { unmatched++; return; }

    // Get verses in range
    const rangeVerses = chapterVerses.filter(v => 
      v.verse >= parsed.verseStart && v.verse <= parsed.verseEnd
    );
    
    if (rangeVerses.length === 0) {
      unmatched++;
      return;
    }

    // Combine text for multi-verse
    const combinedText = rangeVerses.map(v => {
      if (parsed.verseStart === parsed.verseEnd) return v.text;
      return `${v.verse}. ${v.text}`;
    }).join(' ');

    verseLookup[ref] = {
      ref,
      text: combinedText,
      pericope: rangeVerses[0].pericope,
      book: parsed.book,
      chapter: parsed.chapter,
      verseStart: parsed.verseStart,
      verseEnd: parsed.verseEnd
    };
    matched++;
  });

  console.log(`   Matched: ${matched}, Unmatched: ${unmatched}`);

  // 5. Save to JSON
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'verses_text.json');
  fs.writeFileSync(outputPath, JSON.stringify(verseLookup, null, 2));
  const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`\n💾 Saved: ${outputPath}`);
  console.log(`   File size: ${fileSize} KB`);

  // 6. Storage estimation
  const sampleSize = JSON.stringify(Object.values(verseLookup).slice(0, 10)).length;
  const avgPerVerse = sampleSize / 10;
  const totalJSON = avgPerVerse * Object.keys(verseLookup).length;
  
  console.log('\n📊 ESTIMASI PENYIMPANAN:');
  console.log(`   JSON file:       ${fileSize} KB`);
  console.log(`   Avg per ayat:    ~${avgPerVerse.toFixed(0)} bytes`);
  console.log(`   Total MongoDB:   ~${(totalJSON / 1024).toFixed(1)} KB (~${(totalJSON / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`   Dengan index:    ~${(totalJSON * 1.3 / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Free tier 512MB: AMAN! (pakai < 0.2%)`);

  // 7. Show samples
  console.log('\n📝 SAMPEL HASIL:');
  const samples = ['Yohanes 3:16', 'Mazmur 23:1', 'Roma 8:28', 'Yeremia 29:11', 'Filipi 4:13'];
  samples.forEach(ref => {
    const v = verseLookup[ref];
    if (v) {
      console.log(`\n   📌 ${ref}`);
      console.log(`      Perikop: ${v.pericope}`);
      console.log(`      Teks: ${v.text.substring(0, 100)}${v.text.length > 100 ? '...' : ''}`);
    } else {
      console.log(`\n   ❌ ${ref} — not found`);
    }
  });
})();
