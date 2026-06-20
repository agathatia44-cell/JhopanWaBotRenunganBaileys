# 📖 Perbedaan Verse Pool vs Bible Verses

## TL;DR

```
verse_pool (1825 ayat)     → Ayat yang BOLEH dipakai untuk renungan (kurasi)
bible_verses (31,102 ayat) → Database LENGKAP Alkitab untuk inject teks ayat
```

---

## 📚 Verse Pool (1825 ayat)

**Collection:** `verse_pool`  
**Jumlah:** 1825 ayat  
**Fungsi:** Kurasi ayat untuk renungan harian

### Kenapa cuma 1825?

```
1825 ayat = 365 hari × 5 tahun

Kenapa tidak semua ayat Alkitab?
❌ Tidak semua ayat cocok untuk renungan:
   - Silsilah (1 Tawarikh 1-9)
   - Hukum Taurat detail (Imamat 1-7)
   - Daftar nama (Ezra 2, Nehemia 7)
   - Ukuran Bait Suci (1 Raja-raja 6-7)

✅ Hanya ayat yang relevan untuk renungan:
   - Ajaran Yesus
   - Mazmur & Amsal
   - Surat-surat Rasul
   - Nubuatan & janji Tuhan
   - Kisah inspirasi
```

### Struktur:

```json
{
  "uid": "GEN-1-1",
  "ref": "Kejadian 1:1",
  "book": "Kejadian",
  "chapter": 1,
  "verse": 1,
  "usedCount": 0,
  "lastUsed": null,
  "groupId": null
}
```

### Cara Kerja:

```
1. Bot pilih ayat dari pool (1825 ayat)
2. Pastikan belum pernah dipakai (atau sudah lama)
3. Ambil teks ayat dari bible_verses (31,102 ayat)
4. Inject ke AI prompt
5. AI generate renungan
6. Mark ayat sebagai "used" di pool
```

---

## 📖 Bible Verses (31,102 ayat)

**Collection:** `bible_verses`  
**Jumlah:** 31,102 ayat  
**Fungsi:** Database lengkap Alkitab (TB) untuk verse injection

### Kenapa 31,102?

```
31,102 ayat = SELURUH Alkitab Terjemahan Baru

Perjanjian Lama: 23,145 ayat
Perjanjian Baru: 7,957 ayat

Total: 31,102 ayat

Ini adalah database LENGKAP, termasuk:
✅ Ajaran & kisah (untuk renungan)
✅ Silsilah (untuk referensi)
✅ Hukum & peraturan (untuk konteks)
✅ Nubuatan (untuk studi)
✅ Semua ayat tanpa kurasi
```

### Struktur:

```json
{
  "_id": ObjectId("..."),
  "book": "Kejadian",
  "chapter": 1,
  "verse": "1",
  "text": "Pada mulanya Allah menciptakan langit dan bumi.",
  "pericope": "Penciptaan",
  "scrapedAt": ISODate("2026-06-15T10:30:00Z")
}
```

### Cara Kerja:

```
1. Scraper otomatis scrape 1 kitab per jam
2. Simpan ke MongoDB (bible_verses collection)
3. Saat renungan:
   - Bot butuh teks "Kejadian 1:1"
   - Query bible_verses: { book: "Kejadian", chapter: 1, verse: "1" }
   - Dapat: "Pada mulanya Allah menciptakan langit dan bumi."
4. Inject teks ini ke AI prompt
5. AI tidak perlu "ingat" ayat (no hallucination!)
```

---

## 🔄 Alur Kerja Lengkap

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Pilih Ayat (verse_pool - 1825 ayat)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ verse_pool.find({                                               │
│   usedCount: 0,              // belum pernah dipakai           │
│   lastUsed: null             // atau sudah lama                 │
│ })                                                              │
│                                                                 │
│ Result: "Yohanes 3:16" (UID: JHN-3-16)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Ambil Teks Ayat (bible_verses - 31,102 ayat)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ bible_verses.findOne({                                          │
│   book: "Yohanes",                                              │
│   chapter: 3,                                                   │
│   verse: "16"                                                   │
│ })                                                              │
│                                                                 │
│ Result: {                                                       │
│   text: "Karena begitu besar kasih Allah...",                  │
│   pericope: "Percakapan dengan Nikodemus"                      │
│ }                                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Inject ke AI Prompt                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Prompt:                                                         │
│ "Buat renungan dari Yohanes 3:16                               │
│  Perikop: Percakapan dengan Nikodemus                          │
│  Teks: Karena begitu besar kasih Allah..."                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: AI Generate Renungan                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ AI output:                                                      │
│ "📖 RENUNGAN HARI INI                                          │
│                                                                 │
│ *Yohanes 3:16*                                                 │
│                                                                 │
│ "Karena begitu besar kasih Allah..."                           │
│                                                                 │
│ Ayat ini menunjukkan..."                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Mark Ayat as Used (verse_pool)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ verse_pool.updateOne(                                           │
│   { uid: "JHN-3-16" },                                         │
│   {                                                             │
│     $inc: { usedCount: 1 },                                    │
│     $set: { lastUsed: new Date(), groupId: "..." }            │
│   }                                                             │
│ )                                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Statistik

```
verse_pool (1825 ayat):
  ✅ Sudah dipakai: 450 ayat
  ⏳ Belum dipakai: 1375 ayat
  📅 Cukup untuk: ~3.7 tahun lagi

bible_verses (31,102 ayat):
  ✅ Sudah di-scrape: 31,102 ayat (100%)
  📚 Total kitab: 66
  📖 Total pasal: 1,189
  📝 Total ayat: 31,102
```

---

## 🤔 Kenapa Dua Collection?

```
❌ Kalau pakai bible_verses langsung untuk pilih ayat:
   - Bot bisa pilih ayat silsilah (1 Tawarikh 1:1-34)
   - Bot bisa pilih ayat hukum detail (Imamat 1:1-17)
   - Renungan jadi tidak relevan!

✅ Kalau pakai verse_pool:
   - Hanya ayat yang cocok untuk renungan
   - Kualitas renungan terjamin
   - Tidak ada ayat "aneh" yang dipilih

✅ bible_verses tetap dibutuhkan:
   - Untuk inject teks ayat yang akurat
   - AI tidak perlu "ingat" ayat (no hallucination)
   - Teks ayat PASTI sesuai Terjemahan Baru
```

---

## 🎯 Kesimpulan

```
verse_pool (1825) = KURASI ayat untuk renungan
  → "Ayat mana yang BOLEH dipakai?"
  → Filter: hanya ayat relevan untuk renungan

bible_verses (31,102) = DATABASE lengkap Alkitab
  → "Apa TEKS ayatnya?"
  → Sumber: scraping alkitab.mobi (TB)

Keduanya bekerja sama:
  1. verse_pool pilih ayat yang cocok
  2. bible_verses kasih teks yang akurat
  3. AI generate renungan berkualitas
```
