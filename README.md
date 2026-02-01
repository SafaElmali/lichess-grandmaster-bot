# Lichess Grandmaster Bot

Automated chess bot that plays on Lichess using Stockfish with opening book, anti-detection, tournament mode, and Telegram notifications.

## Features

- **Stockfish Engine** - Configurable depth for strength vs speed
- **Opening Book** - Uses popular openings for first N moves
- **Anti-Detection** - Random delays, thinking pauses, human-like mouse movements
- **Tournament Mode** - Auto-join and play arena tournaments with auto-berserk
- **Telegram Bot** - Game notifications and remote control via commands

## Setup

1. Install dependencies:
```bash
npm install
npx playwright install chromium
brew install stockfish  # macOS
```

2. Run the setup wizard:
```bash
npm run setup
```

3. Add your credentials to `.env`:
```env
LICHESS_USERNAME=your_username
LICHESS_PASSWORD=your_password

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

4. Run the bot:
```bash
npm start
```

Press `Ctrl+C` to stop.

## Configuration

Edit `config.json` to customize:

```json
{
  "game": {
    "timeControl": "5+0",
    "mode": "quickplay",
    "maxGames": 0
  },
  "engine": {
    "depth": 15
  },
  "openingBook": {
    "enabled": true,
    "maxMoves": 10
  },
  "antiDetection": {
    "enabled": true,
    "moveDelay": { "baseMs": 500, "variance": 0.4 },
    "thinkingPauses": true,
    "humanMouse": true
  },
  "tournament": {
    "enabled": false,
    "url": null,
    "autoBerserk": false
  },
  "telegram": {
    "enabled": false
  }
}
```

## Telegram Setup

1. Message **@BotFather** on Telegram and create a bot with `/newbot`
2. Copy the bot token
3. Message **@userinfobot** to get your chat ID
4. Add to `.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```
5. Set `telegram.enabled` to `true` in `config.json`

### Telegram Commands

| Command | Description |
|---------|-------------|
| `/status` | Current bot status and win rate |
| `/stats` | Session statistics |
| `/config` | Show current configuration |
| `/set depth 20` | Change engine depth (5-30) |
| `/set time 3+0` | Change time control |
| `/set maxgames 10` | Set max games (0 = unlimited) |
| `/stop` | Pause after current game |
| `/start` | Resume playing |
| `/help` | List all commands |

## Tournament Mode

1. Set `tournament.enabled` to `true` in `config.json`
2. Set `tournament.url` to the tournament URL (e.g., `https://lichess.org/tournament/xxxxx`)
3. Optionally enable `tournament.autoBerserk`
4. Run `npm start`

The bot will join the tournament and automatically play each pairing.

## File Structure

```
lichess-grandmaster-bot/
├── bot.js                    # Entry point
├── setup.js                  # Config wizard
├── config.json               # Settings
├── .env                      # Credentials (not committed)
├── data/
│   └── openings.json         # Opening book data
└── src/
    ├── LichessBot.js         # Main bot orchestrator
    ├── engine/
    │   ├── StockfishEngine.js
    │   └── OpeningBook.js
    ├── browser/
    │   ├── LichessController.js
    │   └── HumanBehavior.js
    ├── modes/
    │   └── TournamentMode.js
    └── telegram/
        └── TelegramBot.js
```

## How It Works

1. Logs into Lichess automatically
2. Starts a game (or joins tournament)
3. Uses opening book for first moves, then Stockfish
4. Applies human-like delays and mouse movements
5. Sends game results to Telegram
6. When game ends, automatically starts a new one
