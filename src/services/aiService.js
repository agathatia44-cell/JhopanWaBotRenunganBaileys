/**
 * AI Service - Multi Provider Support
 * Mendukung: Custom OpenAI-Compatible API, OpenRouter, Gemini
 * Rate limiting: 5 detik antara request
 */

const axios = require("axios");
const moment = require("moment-timezone");
const fs = require("fs-extra");
moment.locale("id"); // Bahasa Indonesia
moment.tz.setDefault(process.env.TIMEZONE || "Asia/Makassar");

// Rate limiting config (hemat bandwidth - 5 detik antar request)
const RATE_LIMIT_MS = 5000; // 5 detik
const RATE_LIMIT_FILE = "./src/data/ai_rate_limit.json";

// API Endpoints
const API_ENDPOINTS = {
  custom: process.env.AI_API_ENDPOINT || "",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
};

// Timeout untuk API requests (hemat resource)
const API_TIMEOUT = 45000; // 45 detik

// Multiple API Keys Support dengan auto-rotation
let currentApiKeyIndex = 0;
const API_KEYS = {
  custom: (process.env.AI_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k),
  gemini: (process.env.GEMINI_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k),
  openrouter: (process.env.OPENROUTER_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k),
};

// Counter untuk setiap API key (untuk track usage)
const apiKeyUsage = {
  custom: {},
  gemini: {},
  openrouter: {},
};

/**
 * Get AI provider - priority: Custom > OpenRouter > Gemini
 */
function getProvider() {
  // 1. Custom OpenAI-compatible endpoint (highest priority)
  if (process.env.AI_API_ENDPOINT && process.env.AI_API_KEY) {
    console.log(`🔍 Provider: Custom (${process.env.AI_API_ENDPOINT})`);
    return "custom";
  }

  const model = process.env.AI_MODEL || "moonshotai/kimi-k2:free";
  console.log(`🔍 Detecting provider untuk model: ${model}`);

  // 2. OpenRouter models (moonshot, mistral, llama, dll)
  if (
    model.includes("moonshot") ||
    model.includes("kimi") ||
    model.includes("mistral") ||
    model.includes("llama") ||
    model.includes("/") ||
    model.includes(":")
  ) {
    console.log(`✅ Provider detected: OpenRouter`);
    return "openrouter";
  }

  // 3. Gemini
  if (model.includes("gemini")) {
    console.log(`✅ Provider detected: Gemini`);
    return "gemini";
  }

  console.log(`✅ Provider default: OpenRouter`);
  return "openrouter"; // default
}

/**
 * Get API key dengan rotation (switch otomatis sebelum limit)
 * @param {string} provider - "gemini" atau "openrouter"
 * @param {number} maxUsagePerKey - Max request per key sebelum switch (default: limit - 2)
 */
function getApiKey(provider, maxUsagePerKey = 13) {
  const keys = API_KEYS[provider] || [];

  if (keys.length === 0) {
    throw new Error(`❌ Tidak ada API key untuk provider: ${provider}`);
  }

  // Single key, return langsung
  if (keys.length === 1) {
    return keys[0];
  }

  // Multiple keys, rotation logic
  if (!apiKeyUsage[provider]) {
    apiKeyUsage[provider] = {};
  }

  // Find key dengan usage paling sedikit
  let bestKeyIndex = 0;
  let minUsage = Infinity;

  for (let i = 0; i < keys.length; i++) {
    const usage = apiKeyUsage[provider][i] || 0;
    if (usage < minUsage) {
      minUsage = usage;
      bestKeyIndex = i;
    }
  }

  // Check apakah key ini sudah mendekati limit
  const currentUsage = apiKeyUsage[provider][bestKeyIndex] || 0;

  if (currentUsage >= maxUsagePerKey) {
    console.log(
      `⚠️ API key #${bestKeyIndex + 1} mendekati limit (${currentUsage}/${maxUsagePerKey}), switching...`,
    );

    // Find next available key dengan usage rendah
    for (let i = 0; i < keys.length; i++) {
      const usage = apiKeyUsage[provider][i] || 0;
      if (usage < maxUsagePerKey) {
        bestKeyIndex = i;
        break;
      }
    }

    // Reset semua counter jika semua key sudah penuh
    if ((apiKeyUsage[provider][bestKeyIndex] || 0) >= maxUsagePerKey) {
      console.log(`🔄 Semua API key mendekati limit, reset counter...`);
      apiKeyUsage[provider] = {};
      bestKeyIndex = 0;
    }
  }

  // Increment usage
  apiKeyUsage[provider][bestKeyIndex] =
    (apiKeyUsage[provider][bestKeyIndex] || 0) + 1;

  console.log(
    `🔑 Menggunakan ${provider} API key #${bestKeyIndex + 1} (usage: ${apiKeyUsage[provider][bestKeyIndex]}/${maxUsagePerKey})`,
  );

  return keys[bestKeyIndex];
}

/**
 * Rate limiting checker (5 menit antara request)
 */
async function checkRateLimit() {
  try {
    let rateLimitData = { lastRequest: 0 };

    if (await fs.pathExists(RATE_LIMIT_FILE)) {
      rateLimitData = await fs.readJson(RATE_LIMIT_FILE);
    }

    const now = Date.now();
    const timeSinceLastRequest = now - rateLimitData.lastRequest;

    if (timeSinceLastRequest < RATE_LIMIT_MS && rateLimitData.lastRequest > 0) {
      const remainingMs = RATE_LIMIT_MS - timeSinceLastRequest;
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new Error(
        `⏳ Rate limit: tunggu ${remainingSec} detik lagi (max 15 req/menit)`,
      );
    }

    // Update last request time
    await fs.writeJson(RATE_LIMIT_FILE, { lastRequest: now });
    return true;
  } catch (error) {
    if (error.message.includes("Rate limit")) throw error;
    // File error, allow request
    await fs.writeJson(RATE_LIMIT_FILE, { lastRequest: Date.now() });
    return true;
  }
}

/**
 * Generate renungan menggunakan AI (Moonshot/Gemini)
 * @param {string} verseRef - Referensi ayat (contoh: "Yohanes 3:16")
 * @param {string} specialDay - Hari spesial (optional)
 */
async function generateRenungan(verseRef, specialDay = null) {
  // Check rate limit (5 menit)
  await checkRateLimit();

  const provider = getProvider();
  const apiKey = getApiKey(provider); // Use rotation
  const model = process.env.AI_MODEL || "moonshotai/kimi-k2:free";

  if (!apiKey) {
    throw new Error("AI_API_KEY belum diatur di .env");
  }

  const today = moment().format("dddd, DD MMMM YYYY");
  let prompt = "";

  if (specialDay) {
    prompt = `
Kamu adalah seorang pendeta Kristen yang bijak. Buatkan renungan harian untuk memperingati ${specialDay}.

Ayat: ${verseRef}

INSTRUKSI PENTING:
1. Cari dan tuliskan ISI LENGKAP ayat ${verseRef} dari Alkitab Terjemahan Baru Indonesia
2. JIKA ayatnya lebih dari 1 (misal 3:16-17), pisahkan dengan nomor ayat:
   16. [isi ayat 16]
   17. [isi ayat 17]
3. JIKA ayatnya cuma 1 (misal 3:16), tulis langsung tanpa nomor
4. Buat refleksi 2 paragraf yang menghubungkan ayat dengan ${specialDay}
5. Gunakan bahasa Indonesia yang hangat dan mudah dipahami
6. Khusus untuk mahasiswa/anak muda Kristen

FORMAT OUTPUT (WAJIB IKUTI PERSIS):
Syalom teman-teman PMKFT😇
Yukk kita baca renungan sejenak!

*RENUNGAN HARI INI - ${today}*

*${verseRef}*

_[ISI AYAT - dengan nomor jika lebih dari 1 ayat]_

[PARAGRAF REFLEKSI 1 - makna dan konteks]

[PARAGRAF REFLEKSI 2 - aplikasi untuk ${specialDay}]

Amin
Selamat beraktivitas
Tuhan Yesus memberkati kita semua💗✨
`.trim();
  } else {
    prompt = `
Kamu adalah seorang pendeta Kristen yang bijak dan penuh kasih. Buatkan renungan harian.

Ayat: ${verseRef}

INSTRUKSI PENTING:
1. Cari dan tuliskan ISI LENGKAP ayat ${verseRef} dari Alkitab Terjemahan Baru Indonesia
2. JIKA ayatnya lebih dari 1 (contoh: Yohanes 3:16-17), pisahkan dengan nomor:
   16. [isi lengkap ayat 16]
   17. [isi lengkap ayat 17]
3. JIKA ayatnya cuma 1 (contoh: Yohanes 3:16), tulis langsung tanpa nomor
4. Buat refleksi 2 paragraf yang mendalam dan aplikatif
5. Gunakan bahasa Indonesia yang hangat dan natural
6. Ditujukan untuk mahasiswa/anak muda Kristen
7. Hubungkan dengan kehidupan sehari-hari (kuliah, pekerjaan, relasi)

FORMAT OUTPUT (WAJIB IKUTI PERSIS):
Syalom teman-teman PMKFT😇
Yukk kita baca renungan sejenak!

*RENUNGAN HARI INI - ${today}*

*${verseRef}*

_[ISI AYAT - pisahkan dengan nomor jika lebih dari 1 ayat]_

[PARAGRAF REFLEKSI 1 - konteks dan makna ayat]

[PARAGRAF REFLEKSI 2 - aplikasi praktis untuk kehidupan]

Amin
Selamat beraktivitas
Tuhan Yesus memberkati kita semua💗✨
`.trim();
  }

  const maxRetries = 2; // Kurangi retry karena sudah ada rate limiting
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `🤖 AI Request ke ${provider.toUpperCase()} (${attempt}/${maxRetries})...`,
      );

      let response;

      if (provider === "custom") {
        // Custom OpenAI-compatible API endpoint
        const endpoint = API_ENDPOINTS.custom.endsWith("/")
          ? API_ENDPOINTS.custom.slice(0, -1)
          : API_ENDPOINTS.custom;
        response = await axios.post(
          `${endpoint}/chat/completions`,
          {
            model: model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 1536,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: API_TIMEOUT,
          },
        );

        const generatedText = response.data?.choices?.[0]?.message?.content;
        if (!generatedText) {
          throw new Error("Tidak ada respons dari Custom AI");
        }
        console.log("✅ Custom AI berhasil generate renungan");
        return generatedText.trim();
      } else if (provider === "openrouter") {
        // OpenRouter API (support moonshot, mistral, llama, dll)
        response = await axios.post(
          API_ENDPOINTS.openrouter,
          {
            model: model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 1536, // Dikurangi dari 2048
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://github.com/jhopan/Bot-WA-Ringan",
              "X-Title": "WhatsApp Telegram Bot",
            },
            timeout: API_TIMEOUT,
          },
        );

        const generatedText = response.data?.choices?.[0]?.message?.content;
        if (!generatedText) {
          throw new Error("Tidak ada respons dari OpenRouter AI");
        }
        console.log("✅ OpenRouter AI berhasil generate renungan");
        return generatedText.trim();
      } else {
        // Gemini direct (pakai model dari .env)
        response = await axios.post(
          `${API_ENDPOINTS.gemini}/${model}:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1536 },
          },
          { timeout: API_TIMEOUT },
        );

        const generatedText =
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!generatedText) {
          throw new Error("Tidak ada respons dari Gemini");
        }
        console.log("✅ Gemini berhasil generate renungan");
        return generatedText.trim();
      }
    } catch (error) {
      lastError = error;

      // Handle network errors
      if (
        error.code === "ENOTFOUND" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNRESET"
      ) {
        console.log(`⚠️ Network error, retry ${attempt}/${maxRetries}...`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          continue;
        }
      }

      // Handle API errors
      if (error.response) {
        const errData = error.response.data;
        const errMsg = errData?.error?.message || "Unknown error";

        console.error(`❌ AI API Error [${error.response.status}]:`, errMsg);

        // Jangan retry untuk error 400 (bad request)
        if (error.response.status === 400) {
          throw new Error(`AI Error: ${errMsg}`);
        }

        // Retry untuk error 500, 503, 429 (server error / rate limit)
        if (
          attempt < maxRetries &&
          [500, 503, 429].includes(error.response.status)
        ) {
          const waitTime =
            error.response.status === 429 ? 5000 : 2000 * attempt;
          console.log(
            `⏳ Server error/rate limit, retry dalam ${waitTime / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        // Kalau 429 dan sudah habis retry, kasih pesan jelas
        if (error.response.status === 429) {
          throw new Error(
            `⚠️ Model OpenRouter penuh. Bot akan coba lagi besok pagi jam ${
              process.env.RENUNGAN_TIME || "08:00"
            }. Atau ganti model di .env`,
          );
        }
      }

      // Last attempt failed
      if (attempt === maxRetries) {
        break;
      }
    }
  }

  // All retries failed
  if (lastError) {
    if (lastError.response) {
      const errMsg = lastError.response.data?.error?.message || "Unknown error";
      throw new Error(`AI Error: ${errMsg}`);
    }
    throw new Error(`Network error: ${lastError.message}`);
  }

  throw new Error("AI request failed after all retries");
}

/**
 * Cek apakah hari ini adalah hari spesial
 * Menggunakan logika sederhana tanpa AI (hemat quota)
 */
/**
 * Hitung tanggal Paskah menggunakan algoritma Computus (Gregorian calendar)
 * @param {number} year - Tahun yang ingin dihitung
 * @returns {moment} - Tanggal Paskah
 */
function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return moment({ year, month: month - 1, day });
}

/**
 * Cek apakah hari ini adalah hari spesial Kristen
 * Termasuk hari dengan tanggal tetap dan tanggal bergerak (Paskah, dll)
 */
async function checkSpecialDay() {
  const today = moment();
  const day = today.date();
  const month = today.month() + 1; // moment month is 0-indexed
  const year = today.year();

  // Daftar hari spesial (tanggal tetap)
  const specialDays = {
    "25-12": "Hari Natal",
    "1-1": "Tahun Baru",
    "17-8": "Hari Kemerdekaan Indonesia",
    "14-2": "Hari Kasih Sayang",
    "22-12": "Hari Ibu",
    "12-11": "Hari Ayah",
    "31-12": "Malam Tahun Baru",
    "6-1": "Epifani",
    "1-11": "Hari Orang Kudus",
  };

  const dateKey = `${day}-${month}`;

  // Cek tanggal tetap
  if (specialDays[dateKey]) {
    console.log(`🎉 Hari spesial terdeteksi: ${specialDays[dateKey]}`);
    return specialDays[dateKey];
  }

  // Cek hari spesial dengan tanggal bergerak (Paskah & turunannya)
  const easter = calculateEaster(year);

  // Jumat Agung (2 hari sebelum Paskah)
  if (today.isSame(easter.clone().subtract(2, "days"), "day")) {
    console.log("🎉 Hari spesial terdeteksi: Jumat Agung");
    return "Jumat Agung";
  }

  // Paskah
  if (today.isSame(easter, "day")) {
    console.log("🎉 Hari spesial terdeteksi: Hari Paskah");
    return "Hari Paskah";
  }

  // Kenaikan Yesus (39 hari setelah Paskah)
  if (today.isSame(easter.clone().add(39, "days"), "day")) {
    console.log("🎉 Hari spesial terdeteksi: Kenaikan Yesus Kristus");
    return "Kenaikan Yesus Kristus";
  }

  // Pentakosta (49 hari setelah Paskah)
  if (today.isSame(easter.clone().add(49, "days"), "day")) {
    console.log("🎉 Hari spesial terdeteksi: Hari Pentakosta");
    return "Hari Pentakosta";
  }

  // Rabu Abu (46 hari sebelum Paskah)
  if (today.isSame(easter.clone().subtract(46, "days"), "day")) {
    console.log("🎉 Hari spesial terdeteksi: Rabu Abu");
    return "Rabu Abu";
  }

  // Minggu Palma (7 hari sebelum Paskah)
  if (today.isSame(easter.clone().subtract(7, "days"), "day")) {
    console.log("🎉 Hari spesial terdeteksi: Minggu Palma");
    return "Minggu Palma";
  }

  return null;
}

/**
 * Generate ucapan ulang tahun dengan AI
 * @param {string} name - Nama orang yang berulang tahun
 */
async function generateBirthdayWish(name) {
  try {
    await checkRateLimit();

    const provider = getProvider();
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;

    if (!apiKey) {
      return null;
    }

    const prompt = `
Buatkan ucapan selamat ulang tahun Kristen yang hangat untuk ${name}.

INSTRUKSI:
1. Ucapan harus penuh kasih dan doa
2. Sertakan 1 ayat Alkitab yang relevan (tulis lengkap ayatnya)
3. Gunakan bahasa Indonesia yang hangat
4. Gunakan emoji yang sesuai
5. Maksimal 150 kata

FORMAT (untuk WhatsApp):
🎉🎂 *SELAMAT ULANG TAHUN!* 🎂🎉

Kepada *${name}* yang terkasih,

[Ucapan hangat 2-3 kalimat]

_"[Ayat Alkitab lengkap]"_
📖 [Referensi ayat]

[Doa singkat 1-2 kalimat]

Tuhan Yesus memberkati! 🙏💕
`.trim();

    if (provider === "openrouter") {
      const response = await axios.post(
        API_ENDPOINTS.openrouter,
        {
          model: model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9,
          max_tokens: 512,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/jhopan/Bot-WA-Ringan",
            "X-Title": "WhatsApp Telegram Bot",
          },
          timeout: 30000,
        },
      );
      return response.data?.choices?.[0]?.message?.content?.trim();
    }

    return null;
  } catch (error) {
    console.error("❌ Error generate birthday wish:", error.message);
    return null;
  }
}

/**
 * Test koneksi AI (skip rate limit untuk test)
 */
async function testAIConnection() {
  const provider = getProvider();
  const apiKey = getApiKey(provider) || process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "moonshotai/kimi-k2:free";

  if (!apiKey) {
    return { success: false, error: "API Key tidak diatur" };
  }

  try {
    if (provider === "custom") {
      // Custom OpenAI-compatible endpoint
      const endpoint = API_ENDPOINTS.custom.endsWith("/")
        ? API_ENDPOINTS.custom.slice(0, -1)
        : API_ENDPOINTS.custom;
      const response = await axios.post(
        `${endpoint}/chat/completions`,
        {
          model: model,
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 10,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      );

      if (response.data?.choices?.[0]?.message) {
        return { success: true, provider, model };
      }
    } else if (provider === "openrouter") {
      const response = await axios.post(
        API_ENDPOINTS.openrouter,
        {
          model: model,
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 10,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/jhopan/Bot-WA-Ringan",
            "X-Title": "WhatsApp Telegram Bot",
          },
          timeout: 15000,
        },
      );

      if (response.data?.choices?.[0]?.message) {
        return { success: true, provider, model };
      }
    }
    return { success: false, error: "Response tidak valid" };
  } catch (error) {
    const errMsg = error.response?.data?.error || error.message;
    return { success: false, error: errMsg };
  }
}

/**
 * Generate ayat alkitab untuk ucapan ulang tahun
 * @param {string} name - Nama orang yang berulang tahun
 * @returns {string} - Ayat alkitab dengan format yang sesuai
 */
async function generateBirthdayVerse(name) {
  const provider = getProvider();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "moonshotai/kimi-k2:free";

  if (!apiKey) {
    // Return default verse jika tidak ada API key
    return `📖 _"Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan."_\n— Yeremia 29:11`;
  }

  const prompt = `Berikan satu ayat Alkitab yang cocok untuk ucapan ulang tahun.
Nama: ${name}

Format output HARUS seperti ini:
📖 _"[Isi ayat lengkap]"_
— [Nama Kitab Bab:Ayat]

Pilih ayat yang memberikan berkat, harapan, atau sukacita untuk ulang tahun.
Contoh ayat yang cocok: Yeremia 29:11, Mazmur 20:4, Bilangan 6:24-26, Yosua 1:9

Output HANYA ayat dengan format di atas, tanpa penjelasan tambahan.`;

  try {
    if (provider === "openrouter") {
      const response = await axios.post(
        API_ENDPOINTS.openrouter,
        {
          model: model,
          messages: [
            {
              role: "system",
              content:
                "Kamu adalah asisten yang memberikan ayat Alkitab untuk ucapan ulang tahun.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/jhopan/Bot-WA-Ringan",
            "X-Title": "WhatsApp Telegram Bot",
          },
          timeout: 30000,
        },
      );

      const verse = response.data?.choices?.[0]?.message?.content?.trim();
      if (verse) {
        return verse;
      }
    }

    // Fallback to default verse
    return `📖 _"Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan."_\n— Yeremia 29:11`;
  } catch (error) {
    console.error("❌ Error generate birthday verse:", error.message);
    // Return default verse on error
    return `📖 _"Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan."_\n— Yeremia 29:11`;
  }
}

module.exports = {
  generateRenungan,
  checkSpecialDay,
  testAIConnection,
  getProvider,
  checkRateLimit,
};
