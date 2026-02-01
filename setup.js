import { createInterface } from 'readline';
import { writeFileSync, existsSync, copyFileSync } from 'fs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

const select = async (prompt, options) => {
  console.log(`\n${prompt}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt.label}`));

  while (true) {
    const answer = await question(`\nChoice (1-${options.length}): `);
    const idx = parseInt(answer) - 1;
    if (idx >= 0 && idx < options.length) {
      return options[idx].value;
    }
    console.log('Invalid choice, try again.');
  }
};

const yesNo = async (prompt) => {
  const answer = await question(`${prompt} (y/n): `);
  return answer.toLowerCase().startsWith('y');
};

async function setup() {
  console.log('\n🎮 Lichess Grandmaster Bot Setup\n');
  console.log('━'.repeat(50));

  // ========================================
  // Game Mode
  // ========================================
  console.log('\n📋 GAME MODE\n');

  const gameMode = await select('What mode do you want to play?', [
    { label: 'Quickplay - Play random opponents', value: 'quickplay' },
    { label: 'Tournament - Join arena tournament', value: 'tournament' }
  ]);

  let tournamentUrl = null;
  let autoBerserk = false;

  if (gameMode === 'tournament') {
    tournamentUrl = await question('\nTournament URL: ');
    autoBerserk = await yesNo('Auto-berserk?');
  }

  // ========================================
  // Time Control
  // ========================================
  console.log('\n⏱️  TIME CONTROL\n');

  const timeControl = await select('What time control?', [
    { label: '1+0 (Bullet)', value: '1+0' },
    { label: '2+1 (Bullet)', value: '2+1' },
    { label: '3+0 (Blitz)', value: '3+0' },
    { label: '5+0 (Blitz) - Recommended', value: '5+0' },
    { label: '10+0 (Rapid)', value: '10+0' },
    { label: '15+10 (Rapid)', value: '15+10' }
  ]);

  // ========================================
  // Max Games
  // ========================================
  const maxGames = await select('How many games to play?', [
    { label: 'Unlimited', value: 0 },
    { label: '5 games', value: 5 },
    { label: '10 games', value: 10 },
    { label: '25 games', value: 25 },
    { label: '50 games', value: 50 }
  ]);

  // ========================================
  // Engine Settings
  // ========================================
  console.log('\n🧠 ENGINE SETTINGS\n');

  const depth = await select('Engine strength?', [
    { label: 'Fast (depth 10) - Quick moves', value: 10 },
    { label: 'Balanced (depth 15) - Recommended', value: 15 },
    { label: 'Strong (depth 20) - Slower but stronger', value: 20 },
    { label: 'Maximum (depth 25) - Very slow, very strong', value: 25 }
  ]);

  // ========================================
  // Opening Book
  // ========================================
  console.log('\n📚 OPENING BOOK\n');

  const openingBookEnabled = await yesNo('Use opening book for first moves?');
  let openingBookMaxMoves = 10;

  if (openingBookEnabled) {
    openingBookMaxMoves = await select('Use book for how many moves?', [
      { label: 'First 5 moves', value: 5 },
      { label: 'First 10 moves - Recommended', value: 10 },
      { label: 'First 15 moves', value: 15 }
    ]);
  }

  // ========================================
  // Anti-Detection
  // ========================================
  console.log('\n🕵️  ANTI-DETECTION\n');

  const antiDetectionEnabled = await yesNo('Enable anti-detection features?');
  let moveDelay = { baseMs: 500, variance: 0.4 };
  let thinkingPauses = true;
  let humanMouse = true;

  if (antiDetectionEnabled) {
    const moveSpeed = await select('Move speed?', [
      { label: 'Fast (300ms base)', value: 300 },
      { label: 'Normal (500ms base) - Recommended', value: 500 },
      { label: 'Human-like (800ms base)', value: 800 }
    ]);
    moveDelay.baseMs = moveSpeed;

    thinkingPauses = await yesNo('Add random thinking pauses?');
    humanMouse = await yesNo('Use human-like mouse movements?');
  }

  // ========================================
  // Telegram Notifications
  // ========================================
  console.log('\n📱 TELEGRAM NOTIFICATIONS\n');

  const telegramEnabled = await yesNo('Enable Telegram notifications and control?');
  let botToken = '';
  let chatId = '';

  if (telegramEnabled) {
    console.log('\nTo set up Telegram:');
    console.log('1. Message @BotFather on Telegram');
    console.log('2. Create a bot with /newbot');
    console.log('3. Copy the bot token\n');

    botToken = await question('Bot token: ');

    console.log('\nTo get your chat ID:');
    console.log('1. Message @userinfobot on Telegram');
    console.log('2. Copy your "Id" number\n');

    chatId = await question('Chat ID: ');
  }

  // ========================================
  // Build Config
  // ========================================
  const config = {
    game: {
      timeControl,
      mode: gameMode,
      maxGames
    },
    engine: {
      depth
    },
    openingBook: {
      enabled: openingBookEnabled,
      maxMoves: openingBookMaxMoves
    },
    antiDetection: {
      enabled: antiDetectionEnabled,
      moveDelay,
      thinkingPauses,
      humanMouse
    },
    tournament: {
      enabled: gameMode === 'tournament',
      url: tournamentUrl,
      autoBerserk
    },
    telegram: {
      enabled: telegramEnabled,
      botToken,
      chatId
    }
  };

  // ========================================
  // Save Config
  // ========================================
  writeFileSync('./config.json', JSON.stringify(config, null, 2));
  console.log('\n✅ Config saved to config.json');

  // Check .env
  if (!existsSync('.env')) {
    if (existsSync('.env.example')) {
      copyFileSync('.env.example', '.env');
      console.log('📄 Created .env from .env.example');
    }
    console.log('\n⚠️  Don\'t forget to edit .env with your Lichess credentials!');
  }

  // Summary
  console.log('\n' + '━'.repeat(50));
  console.log('\n📋 CONFIGURATION SUMMARY\n');
  console.log(`Mode: ${gameMode}`);
  console.log(`Time Control: ${timeControl}`);
  console.log(`Max Games: ${maxGames === 0 ? 'Unlimited' : maxGames}`);
  console.log(`Engine Depth: ${depth}`);
  console.log(`Opening Book: ${openingBookEnabled ? `Yes (${openingBookMaxMoves} moves)` : 'No'}`);
  console.log(`Anti-Detection: ${antiDetectionEnabled ? 'Yes' : 'No'}`);
  console.log(`Telegram: ${telegramEnabled ? 'Yes' : 'No'}`);

  if (gameMode === 'tournament') {
    console.log(`Tournament: ${tournamentUrl}`);
    console.log(`Auto-Berserk: ${autoBerserk ? 'Yes' : 'No'}`);
  }

  console.log('\n' + '━'.repeat(50));
  console.log('\nSetup complete! Run the bot with:');
  console.log('  npm start\n');

  rl.close();
}

setup().catch(console.error);
