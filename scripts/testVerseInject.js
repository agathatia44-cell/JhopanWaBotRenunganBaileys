require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Makassar');
moment.locale('id');
const today = moment().format('dddd, DD MMMM YYYY');

const cache = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'verses_text.json'), 'utf8'));

function callModel(messages) {
  return new Promise((resolve) => {
    const url = new URL(process.env.AI_API_ENDPOINT + '/chat/completions');
    const postData = JSON.stringify({ model: 'gemini/gemini-2.5-flash-lite', messages, temperature: 0.7, max_tokens: 2000, stream: false });
    const options = { hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.AI_API_KEY, 'Content-Length': Buffer.byteLength(postData) } };
    const req = http.request(options, (res) => { let data = ''; res.on('data', c => data += c); res.on('end', () => { try { const j = JSON.parse(data); if (j.error) resolve({error: JSON.stringify(j.error).substring(0,300)}); else resolve({content: j.choices[0].message.content, chars: j.choices[0].message.content.length}); } catch(e) { resolve({error: 'Parse: ' + data.substring(0,300)}); } }); });
    req.on('error', e => resolve({error: e.message}));
    req.setTimeout(90000, () => { req.destroy(); resolve({error: 'TIMEOUT'}); });
    req.write(postData);
    req.end();
  });
}

const systemMsg = 'Kamu adalah seorang kakak rohani yang hangat, dewasa, dan membangun, seperti pembina atau senior PMK yang dekat dengan mahasiswa. Gunakan bahasa Indonesia yang natural, tenang, sopan, dan mudah dipahami. Setiap paragraf harus utuh, mengalir, dan terdiri dari 4-6 kalimat yang mendalam. Hindari kalimat pendek-pendek atau gaya telegram.';

async function testVerse(ref) {
  const v = cache[ref];
  if (!v) { console.log(`❌ ${ref} not in cache`); return null; }
  
  console.log(`\n📖 ${ref} | Perikop: ${v.pericope}`);
  console.log(`   Teks: ${v.text.substring(0, 80)}...`);
  
  const prompt = `Ayat: ${v.ref}
Perikop: ${v.pericope}
Teks ayat: "${v.text}"

TUGAS
Buat renungan yang membangun iman berdasarkan ayat dan perikop di atas. Kamu TIDAK perlu menulis ulang isi ayat karena sudah disediakan. Fokus pada renungan.

ALUR RENUNGAN
Firman Tuhan → Memahami hati Tuhan → Refleksi diri → Respons iman → Doa

Paragraf 1 — Firman Tuhan dan Memahami Hati Tuhan
Jelaskan apa yang ayat ini nyatakan tentang Tuhan, karakter-Nya, maksud-Nya, atau karya-Nya, dengan mempertimbangkan konteks perikop. Fokus pada siapa Tuhan. Jangan langsung nasihat.
Tuliskan paragraf utuh dan mengalir (4-6 kalimat).

Paragraf 2 — Refleksi Diri
Hubungkan dengan kehidupan mahasiswa. Pilih 1-2 pergumulan relevan.
Tuliskan paragraf utuh dan reflektif (4-6 kalimat).

Paragraf 3 — Respons Iman
Respons iman sederhana dan realistis. Biarkan muncul alami dari ayat.
Tuliskan paragraf utuh dan membangun (4-6 kalimat).

Doa: 2-4 kalimat, "kami/kita", syukur + permohonan + penyerahan.

NADA: Hangat, tenang, reflektif, membangun. Tidak menggurui. Tidak terlalu kasual.

FORMAT OUTPUT:
Syalom teman-teman PMKFT😇
Yukk kita baca renungan sejenak!

*RENUNGAN HARI INI - ${today}*

*${v.ref}*

"${v.text}"

───────────────────

[Paragraf 1]

[Paragraf 2]

[Paragraf 3]

Doa:

[Doa]

Amin 🙏

Selamat beraktivitas!
Tuhan Yesus memberkati kita semua💗✨`;

  const start = Date.now();
  const r = await callModel([
    { role: 'system', content: systemMsg },
    { role: 'user', content: prompt }
  ]);
  r.time = Date.now() - start;
  r.ref = ref;
  r.verseData = v;
  
  if (r.error) console.log(`   ❌ ${r.error.substring(0,100)}`);
  else console.log(`   ✅ ${r.chars} chars (${r.time}ms)`);
  
  return r;
}

(async () => {
  const testRefs = ['Roma 8:28', 'Filipi 4:13', 'Yohanes 3:16', 'Yeremia 29:11'];
  const results = [];
  
  for (const ref of testRefs) {
    const r = await testVerse(ref);
    if (r) results.push(r);
    await new Promise(ok => setTimeout(ok, 5000));
  }
  
  // Build markdown
  let md = `# 🧪 Test: Verse Text + Pericope Injected (Flash-lite)\n\n`;
  md += `**Model:** gemini/gemini-2.5-flash-lite\n`;
  md += `**Metode:** System message + verse text + pericope dari cache lokal\n`;
  md += `**Tanggal:** ${today}\n\n---\n\n`;
  
  md += `## 📊 Ringkasan\n\n`;
  md += `| Ayat | Perikop | Chars | Waktu |\n`;
  md += `|------|---------|-------|-------|\n`;
  results.forEach(r => {
    if (!r.error) md += `| ${r.ref} | ${r.verseData.pericope} | ${r.chars} | ${r.time}ms |\n`;
  });
  
  md += `\n---\n\n`;
  
  results.forEach(r => {
    if (r.error) return;
    md += `## ✅ ${r.ref} (${r.chars} chars, ${r.time}ms)\n\n`;
    md += `**Perikop:** ${r.verseData.pericope}\n`;
    md += `**Teks:** ${r.verseData.text}\n\n`;
    md += '```\n' + r.content + '\n```\n\n---\n\n';
  });
  
  const outPath = path.join(__dirname, '..', 'TEST_VERSE_INJECT.md');
  fs.writeFileSync(outPath, md);
  console.log(`\n💾 Saved to TEST_VERSE_INJECT.md`);
})();
