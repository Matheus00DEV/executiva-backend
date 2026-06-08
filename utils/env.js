function boolEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).trim().toLowerCase());
}

function numberEnv(name, defaultValue, options = {}) {
  const raw = process.env[name];
  const value = Number(raw);
  const min = Number.isFinite(options.min) ? options.min : null;
  const max = Number.isFinite(options.max) ? options.max : null;

  if (!Number.isFinite(value)) return defaultValue;
  if (min !== null && value < min) return defaultValue;
  if (max !== null && value > max) return defaultValue;
  return value;
}

function csvEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

module.exports = {
  boolEnv,
  numberEnv,
  csvEnv
};
