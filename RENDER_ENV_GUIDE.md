# Environment Variables untuk Render (Production)
# Tambahkan ini ke Render Dashboard → Environment Variables

# ============================================
# VERSE MODE (Pool System)
# ============================================
# Mode: "pool" (unified 1825 ayat + AI theme) atau "yearly" (per-year 365 ayat)
VERSE_MODE=pool

# Theme pre-compute: menit sebelum waktu renungan untuk generate tema
# Contoh: 30 = generate tema 30 menit sebelum jam 8 (jam 07:30)
THEME_PRECOMPUTE_MINUTES=30

# ============================================
# TTS (Text-to-Speech)
# ============================================
# Enable/disable TTS audio generation
TTS_ENABLED=true

# Voice rotation: ganjil = GadisNeural (wanita), genap = ArdiNeural (pria)
TTS_VOICE_FEMALE=id-ID-GadisNeural
TTS_VOICE_MALE=id-ID-ArdiNeural

# Override voice (kosongkan untuk auto rotation, atau force: id-ID-ArdiNeural / id-ID-GadisNeural)
TTS_VOICE_OVERRIDE=

# TTS settings
TTS_RATE=-0%
TTS_PITCH=+0Hz

# ============================================
# CATATAN PENTING UNTUK RENDER
# ============================================
# 
# 1. Install edge-tts (Python package)
#    Tambahkan di Render build command:
#    pip install edge-tts && npm install
#
#    Atau buat requirements.txt:
#    edge-tts==6.1.10
#
# 2. Pastikan Python tersedia di Render
#    Render sudah include Python by default
#
# 3. Temp directory untuk audio
#    Bot akan otomatis create: temp/tts_audio/
#    Tidak perlu setup manual
#
# 4. Memory usage
#    TTS generation: ~50-100MB additional RAM
#    Total dengan bot: ~200-300MB RAM
#    Render free tier (512MB) masih cukup!
#
