import { Chess } from 'chess.js';
import { chromium } from 'playwright';
import { StockfishEngine } from './engine/StockfishEngine.js';
import { OpeningBook } from './engine/OpeningBook.js';
import { LichessController } from './browser/LichessController.js';
import { HumanBehavior } from './browser/HumanBehavior.js';
import { TournamentMode } from './modes/TournamentMode.js';
import { TelegramBot } from './telegram/TelegramBot.js';

export class LichessBot {
  constructor(config, credentials) {
    this.config = config;
    this.credentials = credentials;
    this.engine = new StockfishEngine(config.engine.depth);
    this.openingBook = config.openingBook?.enabled ? new OpeningBook(config.openingBook) : null;
    this.humanBehavior = config.antiDetection?.enabled ? new HumanBehavior(config.antiDetection) : null;
    this.telegram = config.telegram?.enabled ? new TelegramBot(config.telegram) : null;
    this.controller = null;
    this.chess = new Chess();
    this.browser = null;
    this.tournamentMode = null;
    this.running = true;
    this.paused = false;
    this.gamesPlayed = 0;
    this.stats = { wins: 0, losses: 0, draws: 0 };
  }

  async start() {
    console.log('\n[Bot] Lichess Bot Starting...\n');

    // Start Telegram bot if enabled
    if (this.telegram) {
      await this.telegram.start(this);
      console.log('[Telegram] Bot started!');
    }

    // Start engine
    console.log('[Engine] Starting Stockfish...');
    await this.engine.start();
    console.log('[Engine] Ready!');

    // Launch browser
    console.log('[Browser] Launching...');
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext({ viewport: null });
    const page = await context.newPage();
    this.controller = new LichessController(page, this.humanBehavior);
    console.log('[Browser] Ready!');

    // Login
    const loggedIn = await this.controller.login(
      this.credentials.username,
      this.credentials.password
    );

    if (!loggedIn) {
      throw new Error('Login failed');
    }

    // Choose mode
    if (this.config.tournament?.enabled && this.config.tournament?.url) {
      this.tournamentMode = new TournamentMode(this.controller, this.config.tournament);
      await this.tournamentLoop();
    } else {
      await this.gameLoop();
    }
  }

  async gameLoop() {
    console.log('\n[Bot] Starting game loop...\n');
    const maxGames = this.config.game?.maxGames || 0;

    while (this.running) {
      if (this.paused) {
        await this.controller.sleep(1000);
        continue;
      }

      // Check max games limit
      if (maxGames > 0 && this.gamesPlayed >= maxGames) {
        console.log(`[Bot] Reached max games limit (${maxGames})`);
        await this.sendSessionStats();
        break;
      }

      try {
        await this.controller.startGame(this.config.game.timeControl);

        const gameStarted = await this.controller.waitForGameStart();
        if (!gameStarted) {
          console.log('[Bot] Timeout waiting for game, retrying...');
          continue;
        }

        await this.playGame();
        this.gamesPlayed++;

        console.log(`\n[Bot] Game #${this.gamesPlayed} ended. Starting new game in 3 seconds...\n`);
        await this.controller.sleep(3000);

      } catch (error) {
        console.error('[Bot] Error:', error.message);
        await this.controller.sleep(2000);
      }
    }
  }

  async tournamentLoop() {
    console.log('\n[Bot] Starting tournament mode...\n');

    const joined = await this.controller.joinTournament(this.config.tournament.url);
    if (!joined) {
      console.log('[Bot] Failed to join tournament');
      return;
    }

    while (this.running) {
      if (this.paused) {
        await this.controller.sleep(1000);
        continue;
      }

      try {
        // Wait for pairing
        const paired = await this.controller.waitForTournamentPairing();
        if (!paired) {
          console.log('[Tournament] Tournament ended or no more pairings');
          await this.sendSessionStats();
          break;
        }

        // Auto-berserk if enabled
        if (this.config.tournament.autoBerserk) {
          await this.controller.sleep(500);
          await this.controller.clickBerserk();
        }

        await this.playGame();
        this.gamesPlayed++;

        // Return to tournament page
        await this.controller.page.goto(this.config.tournament.url);
        await this.controller.sleep(2000);

      } catch (error) {
        console.error('[Bot] Error:', error.message);
        await this.controller.sleep(2000);
      }
    }
  }

  async playGame() {
    const myColor = await this.controller.getMyColor();
    const opponent = await this.controller.getOpponentName();
    console.log(`[Game] Playing as ${myColor} vs ${opponent}`);

    this.chess.reset();
    let moveNumber = 0;

    // If black, wait for white's first move
    if (myColor === 'black') {
      console.log('[Game] Waiting for opponent...');
      while (!(await this.controller.isMyTurn(myColor))) {
        if (await this.controller.isGameOver()) {
          await this.handleGameEnd(myColor, opponent);
          return;
        }
        await this.controller.sleep(200);
      }
    }

    // Main game loop
    while (true) {
      if (await this.controller.isGameOver()) {
        await this.handleGameEnd(myColor, opponent);
        return;
      }

      if (await this.controller.isMyTurn(myColor)) {
        moveNumber++;
        const fen = await this.controller.getCurrentFen(this.chess);
        console.log(`[Move ${moveNumber}] Position: ${fen.split(' ')[0].substring(0, 30)}...`);

        let bestMove = null;
        let source = 'Engine';

        // Try opening book first
        if (this.openingBook && moveNumber <= (this.config.openingBook?.maxMoves || 10)) {
          bestMove = this.openingBook.getMove(fen, moveNumber);
          if (bestMove) {
            source = 'Book';
          }
        }

        // Fall back to engine
        if (!bestMove) {
          bestMove = await this.engine.getBestMove(fen);
        }

        console.log(`[Move ${moveNumber}] [${source}] ${bestMove}`);

        // Apply human-like delay
        if (this.humanBehavior) {
          const delay = this.humanBehavior.getRandomDelay(
            this.config.antiDetection.moveDelay.baseMs,
            this.config.antiDetection.moveDelay.variance
          );

          // Random thinking pause
          if (this.humanBehavior.shouldThink(moveNumber)) {
            const thinkTime = 2000 + Math.random() * 6000;
            console.log(`[Move ${moveNumber}] Thinking for ${Math.round(thinkTime / 1000)}s...`);
            await this.controller.sleep(thinkTime);
          }

          await this.controller.sleep(delay);
        } else {
          await this.controller.sleep(this.config.engine?.moveDelayMs || 300);
        }

        await this.controller.makeMove(bestMove, myColor);
      }

      await this.controller.sleep(100);
    }
  }

  async handleGameEnd(myColor, opponent) {
    const result = await this.controller.getGameResult();
    const gameUrl = await this.controller.getGameUrl();

    let outcome;
    if (result === 'draw' || result === 'aborted') {
      outcome = result;
      if (result === 'draw') this.stats.draws++;
    } else if (result === myColor) {
      outcome = 'win';
      this.stats.wins++;
    } else {
      outcome = 'loss';
      this.stats.losses++;
    }

    console.log(`[Game] Result: ${outcome} vs ${opponent}`);

    // Send Telegram notification
    if (this.telegram) {
      await this.telegram.notifyGameEnd(outcome, opponent, gameUrl);
    }
  }

  async sendSessionStats() {
    if (this.telegram) {
      await this.telegram.notifySessionStats(this.stats, this.gamesPlayed);
    }
  }

  getStatus() {
    const winRate = this.gamesPlayed > 0
      ? ((this.stats.wins / this.gamesPlayed) * 100).toFixed(1)
      : 0;

    return {
      running: this.running,
      paused: this.paused,
      gamesPlayed: this.gamesPlayed,
      stats: this.stats,
      winRate: winRate,
      mode: this.tournamentMode ? 'tournament' : 'quickplay',
      timeControl: this.config.game.timeControl,
      engineDepth: this.engine.depth
    };
  }

  pause() {
    this.paused = true;
    console.log('[Bot] Paused - will stop after current game');
  }

  resume() {
    this.paused = false;
    console.log('[Bot] Resumed');
  }

  async stop() {
    console.log('\n[Bot] Shutting down...');
    this.running = false;
    await this.sendSessionStats();
    this.engine.stop();
    if (this.telegram) this.telegram.stop();
    if (this.browser) await this.browser.close();
    console.log('[Bot] Goodbye!');
  }
}
