/**
 * One-time project initialization script
 * Validates environment config and checks for required audio fixtures
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(process.cwd(), '.env') });

const REQUIRED_ENV_VARS = [
  'ASR_BASE_URL',
  'ASR_API_KEY',
];

const RECOMMENDED_ENV_VARS = [
  'GOOGLE_SHEET_ID',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
  'REPORT_EMAIL_TO',
];

const REQUIRED_AUDIO_FILES: string[] = [
  // Add required audio fixture paths here
];

function checkEnv(): void {
  console.log('\n=== Checking Environment ===\n');

  let allRequired = true;
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.error(`  ❌ REQUIRED: ${varName} is not set`);
      allRequired = false;
    } else {
      const display = value.length > 20 ? value.substring(0, 20) + '...' : value;
      console.log(`  ✅ ${varName}: ${display}`);
    }
  }

  for (const varName of RECOMMENDED_ENV_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.log(`  ⚠️  RECOMMENDED: ${varName} is not set`);
    } else {
      console.log(`  ✅ ${varName}: set`);
    }
  }

  if (!allRequired) {
    console.error('\n❌ Missing required environment variables. Copy .env.example to .env and configure.');
    process.exit(1);
  }

  console.log('\n✅ Environment check passed\n');
}

function checkAudio(): void {
  console.log('=== Checking Audio Fixtures ===\n');
  const audioDir = path.resolve(process.cwd(), 'input', 'audio');

  if (!fs.existsSync(audioDir)) {
    console.log(`  ⚠️  Audio directory not found: ${audioDir}`);
    console.log('  Create it and add audio files for testing.');
    return;
  }

  const files = fs.readdirSync(audioDir);
  console.log(`  Audio directory: ${audioDir} (${files.length} entries)`);
}

function checkDirs(): void {
  console.log('\n=== Checking Directory Structure ===\n');
  const dirs = [
    'src/config', 'src/services', 'src/utils', 'src/types',
    'src/features', 'src/reporting', 'scripts', 'input/audio', 'reports', 'deploy',
  ];

  for (const dir of dirs) {
    const fullPath = path.resolve(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✅ ${dir}/`);
    } else {
      console.log(`  ❌ ${dir}/ — MISSING`);
    }
  }
}

async function main(): Promise<void> {
  console.log('=== ASR Testing Framework — Project Initialization ===\n');

  checkEnv();
  checkDirs();
  checkAudio();

  console.log('\n=== Initialization Complete ===\n');
  console.log('Next steps:');
  console.log('  1. Copy .env.example to .env and configure your API key');
  console.log('  2. Add audio fixture files to input/audio/');
  console.log('  3. Run: npx playwright install chromium');
  console.log('  4. Run: npm run test:m13-health (quick sanity check)');
  console.log('  5. Run: npm run test:all (full test suite)');
  console.log();
}

main().catch(err => {
  console.error('Initialization failed:', err);
  process.exit(1);
});
