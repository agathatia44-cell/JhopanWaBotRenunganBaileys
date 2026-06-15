const moment = require("moment-timezone");

/**
 * Format tanggal ke timezone yang ditentukan
 */
function formatDate(date, format = "YYYY-MM-DD HH:mm") {
  return moment(date).tz(process.env.TIMEZONE).format(format);
}

/**
 * Cek apakah waktu sudah lewat
 */
function isPast(dateString) {
  return moment(dateString).isBefore(moment());
}

/**
 * Dapatkan tanggal hari ini
 */
function getToday(format = "YYYY-MM-DD") {
  return moment().tz(process.env.TIMEZONE).format(format);
}

/**
 * Parse tanggal ulang tahun (DD-MM)
 */
function isBirthdayToday(birthdayString) {
  const today = moment().format("DD-MM");
  const birthday = moment(birthdayString, "DD-MM").format("DD-MM");
  return today === birthday;
}

module.exports = {
  formatDate,
  isPast,
  getToday,
  isBirthdayToday,
};
