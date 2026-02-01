# Lichess Grandmaster Bot

Automated chess bot that plays on Lichess using Stockfish.

## Setup

1. Install dependencies:
```bash
npm install
npx playwright install chromium
brew install stockfish  # macOS
```

2. Copy `.env.example` to `.env` and add your credentials:
```bash
cp .env.example .env
```

```env
LICHESS_USERNAME=your_username
LICHESS_PASSWORD=your_password
```

3. Run the bot:
```bash
npm start
```

## Configuration

Edit `config.json` to customize:

```json
{
  "game": {
    "type": "blitz",      // bullet, blitz, or rapid
    "autoQueue": true
  },
  "engine": {
    "depth": 15,          // higher = stronger, slower
    "moveDelayMs": 300    // delay before each move
  }
}
```

## How It Works

1. Logs into Lichess automatically
2. Starts a game (blitz by default)
3. Plays moves calculated by Stockfish
4. When game ends, automatically starts a new one

Press `Ctrl+C` to stop.

## Files

| File | Description |
|------|-------------|
| `.env` | Your credentials (not committed) |
| `.env.example` | Template for credentials |
| `config.json` | Game settings |
| `bot.js` | Main bot code |
