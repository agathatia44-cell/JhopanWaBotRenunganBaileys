const fs = require("fs-extra");
const path = require("path");

/**
 * Membaca file JSON dengan fallback
 */
async function readJsonFile(filePath, defaultValue = []) {
  try {
    await fs.ensureFile(filePath);
    const data = await fs.readJson(filePath);
    return data;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Menulis file JSON dengan format rapi
 */
async function writeJsonFile(filePath, data) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/**
 * Cek apakah file ada
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  fileExists,
};
