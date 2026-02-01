import 'dotenv/config';
import { chromium } from 'playwright';
import { Chess } from 'chess.js';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { readFileSync } from 'fs';

// ============================================================================
// Configuration
// ============================================================================

const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

const credentials = {
  username: process.env.LICHESS_USERNAME,
  password: process.env.LICHESS_PASSWORD
};

if (!credentials.username || !credentials.password) {
  console.error('[Error] Missing LICHESS_USERNAME or LICHESS_PASSWORD in .env file');
  process.exit(1);
}

// ============================================================================
// Stockfish Engine
// ============================================================================

class StockfishEngine {
  constructor(depth = 15) {
    this.depth = depth;
    this.process = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.process = spawn('stockfish');

      const rl = createInterface({ input: this.process.stdout });

      rl.on('line', (line) => {
        if (line === 'uciok') {
          rl.close();
          resolve();
        }
      });

      this.process.stderr.on('data', (data) => {
        console.error('[Stockfish]', data.toString());
      });

      this.process.on('error', reject);
      this.send('uci');
    });
  }

  send(command) {
    this.process.stdin.write(command + '\n');
  }

  async getBestMove(fen) {
    return new Promise((resolve) => {
      const rl = createInterface({ input: this.process.stdout });

      rl.on('line', (line) => {
        if (line.startsWith('bestmove')) {
          rl.close();
          resolve(line.split(' ')[1]);
        }
      });

      this.send(`position fen ${fen}`);
      this.send(`go depth ${this.depth}`);
    });
  }

  stop() {
    if (this.process) {
      this.send('quit');
      this.process.kill();
    }
  }
}

// ============================================================================
// Lichess Browser Controller
// ============================================================================

class LichessController {
  constructor(page) {
    this.page = page;
  }

  async login(username, password) {
    console.log('[Auth] Logging in...');
    await this.page.goto('https://lichess.org/login');
    await this.sleep(1000);

    await this.page.fill('input#form3-username', username);
    await this.page.fill('input#form3-password', password);
    await this.page.click('button.submit');
    await this.sleep(2000);

    const success = await this.page.evaluate(() => {
      return !!document.querySelector('.dasher, a[href="/logout"]');
    });

    console.log(success ? '[Auth] Login successful!' : '[Auth] Login failed!');
    return success;
  }

  async startGame(gameType = 'blitz') {
    console.log(`[Game] Starting ${gameType} game...`);
    await this.page.goto('https://lichess.org');
    await this.sleep(1000);

    // Click on the game type button (blitz, rapid, etc.)
    const selectors = {
      bullet: 'button[data-id="1+0"], .lobby__app button:has-text("1+0")',
      blitz: 'button[data-id="3+0"], button[data-id="5+0"], .lobby__app button:has-text("3+0")',
      rapid: 'button[data-id="10+0"], .lobby__app button:has-text("10+0")'
    };

    // Try to find and click a quick pairing button
    const clicked = await this.page.evaluate((gameType) => {
      // Look for quick pairing buttons in the lobby
      const buttons = document.querySelectorAll('.lobby__app .lobby__start button');

      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (gameType === 'blitz' && (text.includes('3+0') || text.includes('5+0') || text.includes('3+2'))) {
          btn.click();
          return true;
        }
        if (gameType === 'bullet' && (text.includes('1+0') || text.includes('2+1'))) {
          btn.click();
          return true;
        }
        if (gameType === 'rapid' && (text.includes('10+0') || text.includes('15+10'))) {
          btn.click();
          return true;
        }
      }

      // Fallback: try the quick pairing section
      const quickPair = document.querySelector(`[data-id*="${gameType}"], .quick-pairing button`);
      if (quickPair) {
        quickPair.click();
        return true;
      }

      return false;
    }, gameType);

    if (!clicked) {
      console.log('[Game] Could not find quick pairing button, trying alternative...');
      // Try clicking any visible play button
      await this.page.click('.lobby__start button >> nth=0').catch(() => {});
    }

    console.log('[Game] Waiting for game to start...');
  }

  async waitForGameStart(timeout = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const inGame = await this.isInGame();
      if (inGame) {
        await this.sleep(1000); // Let the game fully load
        return true;
      }
      await this.sleep(500);
    }

    return false;
  }

  async isInGame() {
    return await this.page.evaluate(() => {
      const url = window.location.href;
      const isGameUrl = /lichess\.org\/[a-zA-Z0-9]{8,12}/.test(url);
      const hasBoard = !!document.querySelector('cg-board');
      const hasClocks = document.querySelectorAll('.rclock').length >= 2;
      return isGameUrl && hasBoard && hasClocks;
    });
  }

  async getMyColor() {
    return await this.page.evaluate(() => {
      const flipped = !!document.querySelector('.cg-wrap.orientation-black');
      return flipped ? 'black' : 'white';
    });
  }

  async getMoveCount() {
    return await this.page.evaluate(() => {
      let moves = document.querySelectorAll('l4x kwdb');
      if (moves.length === 0) moves = document.querySelectorAll('kwdb');
      return moves.length;
    });
  }

  async isMyTurn(myColor) {
    const moveCount = await this.getMoveCount();
    const whiteToMove = moveCount % 2 === 0;
    return (myColor === 'white' && whiteToMove) || (myColor === 'black' && !whiteToMove);
  }

  async isGameOver() {
    return await this.page.evaluate(() => {
      // Game is active if any clock is running
      const clocks = document.querySelectorAll('.rclock');
      const anyRunning = Array.from(clocks).some(c => c.classList.contains('running'));
      if (anyRunning) return false;

      // Check for game-ending indicators
      const status = document.querySelector('.rcontrols .status')?.textContent?.toLowerCase() || '';
      const endPhrases = ['wins', 'draw', 'time out', 'checkmate', 'stalemate', 'aborted', 'resigned'];

      if (endPhrases.some(p => status.includes(p))) return true;

      // Check for follow-up dialog
      const followUp = document.querySelector('.follow-up');
      if (followUp?.offsetParent) return true;

      return false;
    });
  }

  async getCurrentFen(chess) {
    // Try to reconstruct from moves
    const moves = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('l4x kwdb, kwdb');
      return Array.from(elements)
        .map(el => el.textContent?.trim())
        .filter(m => m && m.length >= 2 && !m.match(/^\d+\.$/));
    });

    if (moves.length > 0 || await this.getMoveCount() === 0) {
      chess.reset();
      for (const move of moves) {
        try {
          chess.move(move.replace(/[!?+#]+$/, ''));
        } catch {
          console.log(`[FEN] Could not parse move: ${move}`);
          break;
        }
      }
      return chess.fen();
    }

    // Starting position
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  async makeMove(move, myColor) {
    const from = move.substring(0, 2);
    const to = move.substring(2, 4);
    const promotion = move.length > 4 ? move[4] : null;

    const isBlack = myColor === 'black';
    const board = await this.page.$('cg-board');
    const box = await board.boundingBox();
    const sq = box.width / 8;

    const toCoords = (square) => {
      const file = square.charCodeAt(0) - 97;
      const rank = parseInt(square[1]) - 1;
      let x = file, y = 7 - rank;
      if (isBlack) { x = 7 - x; y = 7 - y; }
      return { x: box.x + (x + 0.5) * sq, y: box.y + (y + 0.5) * sq };
    };

    const fromPos = toCoords(from);
    const toPos = toCoords(to);

    await this.page.mouse.click(fromPos.x, fromPos.y);
    await this.sleep(50);
    await this.page.mouse.click(toPos.x, toPos.y);

    if (promotion) {
      await this.sleep(200);
      const piece = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[promotion];
      await this.page.click(`.promotion piece.${piece}`).catch(() => {});
    }
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

// ============================================================================
// Main Bot
// ============================================================================

class LichessBot {
  constructor() {
    this.engine = new StockfishEngine(config.engine.depth);
    this.controller = null;
    this.chess = new Chess();
    this.browser = null;
  }

  async start() {
    console.log('\n🎮 Lichess Bot Starting...\n');

    // Start engine
    console.log('[Engine] Starting Stockfish...');
    await this.engine.start();
    console.log('[Engine] Ready!');

    // Launch browser
    console.log('[Browser] Launching...');
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext({ viewport: null });
    const page = await context.newPage();
    this.controller = new LichessController(page);
    console.log('[Browser] Ready!');

    // Login
    const loggedIn = await this.controller.login(
      credentials.username,
      credentials.password
    );

    if (!loggedIn) {
      throw new Error('Login failed');
    }

    // Main game loop
    await this.gameLoop();
  }

  async gameLoop() {
    console.log('\n[Bot] Starting game loop...\n');

    while (true) {
      try {
        // Start a new game
        await this.controller.startGame(config.game.type);

        // Wait for game to start
        const gameStarted = await this.controller.waitForGameStart();
        if (!gameStarted) {
          console.log('[Bot] Timeout waiting for game, retrying...');
          continue;
        }

        // Play the game
        await this.playGame();

        console.log('\n[Bot] Game ended. Starting new game in 3 seconds...\n');
        await this.controller.sleep(3000);

      } catch (error) {
        console.error('[Bot] Error:', error.message);
        await this.controller.sleep(2000);
      }
    }
  }

  async playGame() {
    const myColor = await this.controller.getMyColor();
    console.log(`[Game] Playing as ${myColor}`);

    this.chess.reset();

    // If black, wait for white's first move
    if (myColor === 'black') {
      console.log('[Game] Waiting for opponent...');
      while (!(await this.controller.isMyTurn(myColor))) {
        if (await this.controller.isGameOver()) return;
        await this.controller.sleep(200);
      }
    }

    // Main game loop
    while (true) {
      if (await this.controller.isGameOver()) {
        console.log('[Game] Game over!');
        return;
      }

      if (await this.controller.isMyTurn(myColor)) {
        const fen = await this.controller.getCurrentFen(this.chess);
        console.log(`[Move] Position: ${fen.split(' ')[0].substring(0, 30)}...`);

        const bestMove = await this.engine.getBestMove(fen);
        console.log(`[Move] Best: ${bestMove}`);

        await this.controller.sleep(config.engine.moveDelayMs);
        await this.controller.makeMove(bestMove, myColor);
      }

      await this.controller.sleep(100);
    }
  }

  async stop() {
    console.log('\n[Bot] Shutting down...');
    this.engine.stop();
    if (this.browser) await this.browser.close();
    console.log('[Bot] Goodbye!');
  }
}

// ============================================================================
// Entry Point
// ============================================================================

const bot = new LichessBot();

process.on('SIGINT', async () => {
  await bot.stop();
  process.exit(0);
});

bot.start().catch(async (error) => {
  console.error('[Fatal]', error);
  await bot.stop();
  process.exit(1);
});
