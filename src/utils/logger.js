const moment = require("moment-timezone");

function log(level, message) {
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  const prefix =
    {
      info: "✅",
      error: "❌",
      warn: "⚠️",
      debug: "🔍",
    }[level] || "ℹ️";

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

module.exports = {
  info: (msg) => log("info", msg),
  error: (msg) => log("error", msg),
  warn: (msg) => log("warn", msg),
  debug: (msg) => log("debug", msg),
};
