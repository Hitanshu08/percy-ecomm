#!/usr/bin/env node
/**
 * Test runner script for the frontend.
 */
const { spawn } = require('child_process');
const path = require('path');

function runCommand(command, args = [], description) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Running: ${description}`);
    console.log(`Command: ${command} ${args.join(' ')}`);
    console.log(`${'='.repeat(50)}`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.dirname(__filename)
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully`);
        resolve();
      } else {
        console.log(`❌ ${description} failed with exit code ${code}`);
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.log(`❌ ${description} failed: ${error.message}`);
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const type = args[0] || 'all';
  const verbose = args.includes('--verbose') || args.includes('-v');
  const watch = args.includes('--watch') || args.includes('-w');
  const ui = args.includes('--ui') || args.includes('-u');
  const coverage = args.includes('--coverage') || args.includes('-c');

  try {
    switch (type) {
      case 'unit':
        if (ui) {
          await runCommand('npm', ['run', 'test:ui'], 'Running unit tests with UI');
        } else if (watch) {
          await runCommand('npm', ['run', 'test:watch'], 'Running unit tests in watch mode');
        } else if (coverage) {
          await runCommand('npm', ['run', 'test:coverage'], 'Running unit tests with coverage');
        } else {
          await runCommand('npm', ['run', 'test:run'], 'Running unit tests');
        }
        break;

      case 'e2e':
        if (ui) {
          await runCommand('npm', ['run', 'test:e2e:ui'], 'Running e2e tests with UI');
        } else if (args.includes('--headed')) {
          await runCommand('npm', ['run', 'test:e2e:headed'], 'Running e2e tests in headed mode');
        } else {
          await runCommand('npm', ['run', 'test:e2e'], 'Running e2e tests');
        }
        break;

      case 'all':
        await runCommand('npm', ['run', 'test:run'], 'Running unit tests');
        await runCommand('npm', ['run', 'test:e2e'], 'Running e2e tests');
        break;

      case 'install':
        await runCommand('npm', ['install'], 'Installing dependencies');
        await runCommand('npx', ['playwright', 'install'], 'Installing Playwright browsers');
        break;

      default:
        console.log('Usage: node run_tests.js [unit|e2e|all|install] [options]');
        console.log('Options:');
        console.log('  --verbose, -v    Verbose output');
        console.log('  --watch, -w      Watch mode (unit tests only)');
        console.log('  --ui, -u         UI mode');
        console.log('  --coverage, -c   Coverage report (unit tests only)');
        console.log('  --headed         Headed mode (e2e tests only)');
        process.exit(1);
    }

    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n💥 Tests failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
