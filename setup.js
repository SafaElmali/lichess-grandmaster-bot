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

async function setup() {
  console.log('\n🎮 Lichess Grandmaster Bot Setup\n');
  console.log('━'.repeat(40));

  // Time control
  const timeControl = await select('What time control do you want to play?', [
    { label: '1+0 (Bullet)', value: '1+0' },
    { label: '2+1 (Bullet)', value: '2+1' },
    { label: '3+0 (Blitz)', value: '3+0' },
    { label: '5+0 (Blitz) - Recommended', value: '5+0' },
    { label: '10+0 (Rapid)', value: '10+0' },
    { label: '15+10 (Rapid)', value: '15+10' }
  ]);

  // Engine strength
  const depth = await select('How strong should the bot play?', [
    { label: 'Fast (depth 10) - Quick moves, weaker', value: 10 },
    { label: 'Balanced (depth 15) - Recommended', value: 15 },
    { label: 'Strong (depth 20) - Slower but stronger', value: 20 },
    { label: 'Maximum (depth 25) - Very slow, very strong', value: 25 }
  ]);

  // Move delay
  const moveDelay = await select('How fast should moves be played?', [
    { label: 'Instant (100ms)', value: 100 },
    { label: 'Fast (300ms) - Recommended', value: 300 },
    { label: 'Normal (500ms)', value: 500 },
    { label: 'Human-like (800ms)', value: 800 }
  ]);

  // Create config
  const config = {
    game: {
      timeControl: timeControl,
      autoQueue: true
    },
    engine: {
      depth: depth,
      moveDelayMs: moveDelay
    }
  };

  // Write config
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

  console.log('\n━'.repeat(40));
  console.log('\nSetup complete! Run the bot with:');
  console.log('  npm start\n');

  rl.close();
}

setup().catch(console.error);
