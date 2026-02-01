import 'dotenv/config';
import { readFileSync } from 'fs';
import { LichessBot } from './src/LichessBot.js';

// Load configuration
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

// Load credentials from environment
const credentials = {
  username: process.env.LICHESS_USERNAME,
  password: process.env.LICHESS_PASSWORD
};

if (!credentials.username || !credentials.password) {
  console.error('[Error] Missing LICHESS_USERNAME or LICHESS_PASSWORD in .env file');
  process.exit(1);
}

// Load Telegram credentials from environment if enabled
if (config.telegram?.enabled) {
  config.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN;
  config.telegram.chatId = process.env.TELEGRAM_CHAT_ID;

  if (!config.telegram.botToken || !config.telegram.chatId) {
    console.error('[Error] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env file');
    process.exit(1);
  }
}

// Create and start bot
const bot = new LichessBot(config, credentials);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await bot.stop();
  process.exit(0);
});

// Start the bot
bot.start().catch(async (error) => {
  console.error('[Fatal]', error);
  await bot.stop();
  process.exit(1);
});
