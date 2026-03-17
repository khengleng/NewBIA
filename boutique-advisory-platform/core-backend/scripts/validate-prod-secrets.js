#!/usr/bin/env node

const REQUIRED = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'COOKIE_SECRET',
  'DATABASE_URL',
  'FRONTEND_URL'
];

const ROTATION_FIELDS = [
  'JWT_SECRET_ROTATED_AT',
  'ENCRYPTION_KEY_ROTATED_AT',
  'COOKIE_SECRET_ROTATED_AT'
];

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

if (process.env.NODE_ENV !== 'production') {
  console.log('INFO: NODE_ENV is not production; this script validates production secret policy only.');
}

for (const key of REQUIRED) {
  if (!process.env[key]) {
    fail(`${key} is missing`);
  } else {
    pass(`${key} is present`);
  }
}

const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('sslmode=require')) {
  fail('DATABASE_URL must include sslmode=require for production');
} else if (dbUrl) {
  pass('DATABASE_URL enforces sslmode=require');
}

for (const key of ROTATION_FIELDS) {
  const value = process.env[key];
  if (!value) {
    fail(`${key} is missing (required for rotation evidence)`);
    continue;
  }

  const rotatedAt = new Date(value);
  if (Number.isNaN(rotatedAt.getTime())) {
    fail(`${key} is not a valid date (expected YYYY-MM-DD)`);
    continue;
  }

  const age = Date.now() - rotatedAt.getTime();
  if (age > ONE_YEAR_MS) {
    fail(`${key} is older than 365 days`);
  } else {
    pass(`${key} rotation date is within 365 days`);
  }
}

if (process.exitCode && process.exitCode !== 0) {
  console.error('Production secret policy validation failed.');
  process.exit(process.exitCode);
}

console.log('Production secret policy validation passed.');
