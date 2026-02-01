export class LichessController {
  constructor(page, humanBehavior = null) {
    this.page = page;
    this.humanBehavior = humanBehavior;
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

  async startGame(timeControl = '5+0') {
    console.log(`[Game] Starting ${timeControl} game...`);
    await this.page.goto('https://lichess.org');
    await this.sleep(2000);

    const clicked = await this.page.evaluate((timeControl) => {
      const allElements = document.querySelectorAll('a, button, div[class*="hook"], [class*="quick"] > *');

      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text.startsWith(timeControl)) {
          el.click();
          return { success: true, method: 'text match' };
        }
      }

      const lobbyLinks = document.querySelectorAll('.lobby__app a, .lpools a, [data-pool] a');
      for (const el of lobbyLinks) {
        if (el.textContent?.includes(timeControl)) {
          el.click();
          return { success: true, method: 'lobby link' };
        }
      }

      const poolBtn = document.querySelector(`[data-id="${timeControl}"], [data-pool="${timeControl}"]`);
      if (poolBtn) {
        poolBtn.click();
        return { success: true, method: 'data attr' };
      }

      const found = [];
      document.querySelectorAll('a, button').forEach(el => {
        const text = el.textContent?.trim().substring(0, 20);
        if (text && text.match(/\d\+\d/)) found.push(text);
      });

      return { success: false, found: found.slice(0, 10) };
    }, timeControl);

    if (clicked.success) {
      console.log(`[Game] Clicked ${timeControl} (${clicked.method}) - waiting for opponent...`);
    } else {
      console.log('[Game] Could not find quick pairing button');
      console.log('[Debug] Found elements:', clicked.found);
    }
  }

  async waitForGameStart(timeout = 60000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const inGame = await this.isInGame();
      if (inGame) {
        await this.sleep(1000);
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

  async getOpponentName() {
    return await this.page.evaluate(() => {
      const opponentClock = document.querySelector('.rclock-top .user-link');
      return opponentClock?.textContent?.trim() || 'Unknown';
    });
  }

  async getGameUrl() {
    return await this.page.evaluate(() => window.location.href);
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
      const clocks = document.querySelectorAll('.rclock');
      const anyRunning = Array.from(clocks).some(c => c.classList.contains('running'));
      if (anyRunning) return false;

      const status = document.querySelector('.rcontrols .status')?.textContent?.toLowerCase() || '';
      const endPhrases = ['wins', 'draw', 'time out', 'checkmate', 'stalemate', 'aborted', 'resigned'];

      if (endPhrases.some(p => status.includes(p))) return true;

      const followUp = document.querySelector('.follow-up');
      if (followUp?.offsetParent) return true;

      return false;
    });
  }

  async getGameResult() {
    return await this.page.evaluate(() => {
      const status = document.querySelector('.rcontrols .status')?.textContent?.toLowerCase() || '';
      if (status.includes('aborted')) return 'aborted';
      if (status.includes('draw') || status.includes('stalemate')) return 'draw';

      const resultEl = document.querySelector('.result-wrap .result');
      if (resultEl) {
        const text = resultEl.textContent?.trim();
        if (text === '1-0') return 'white';
        if (text === '0-1') return 'black';
        if (text === '½-½') return 'draw';
      }

      if (status.includes('white wins')) return 'white';
      if (status.includes('black wins')) return 'black';

      return 'unknown';
    });
  }

  async getCurrentFen(chess) {
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

    // Use human-like mouse movement if available
    if (this.humanBehavior?.config?.humanMouse) {
      await this.humanBehavior.humanMouseMove(this.page, fromPos, toPos);
    } else {
      await this.page.mouse.click(fromPos.x, fromPos.y);
      await this.sleep(50);
      await this.page.mouse.click(toPos.x, toPos.y);
    }

    if (promotion) {
      await this.sleep(200);
      const piece = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[promotion];
      await this.page.click(`.promotion piece.${piece}`).catch(() => {});
    }
  }

  // Tournament methods
  async joinTournament(url) {
    console.log(`[Tournament] Joining ${url}...`);
    await this.page.goto(url);
    await this.sleep(2000);

    // Click join button if present
    const joined = await this.page.evaluate(() => {
      const joinBtn = document.querySelector('.fbt.text[data-icon]');
      if (joinBtn && joinBtn.textContent?.toLowerCase().includes('join')) {
        joinBtn.click();
        return true;
      }
      // Already joined if we see withdraw button
      const withdrawBtn = document.querySelector('.fbt.text');
      return withdrawBtn?.textContent?.toLowerCase().includes('withdraw') || false;
    });

    if (joined) {
      console.log('[Tournament] Joined successfully!');
    } else {
      console.log('[Tournament] Could not find join button');
    }
    return joined;
  }

  async isTournamentActive() {
    return await this.page.evaluate(() => {
      const status = document.querySelector('.tour__main__header .clock');
      return !!status;
    });
  }

  async waitForTournamentPairing(timeout = 120000) {
    console.log('[Tournament] Waiting for pairing...');
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const inGame = await this.isInGame();
      if (inGame) return true;

      // Check if tournament ended
      const ended = await this.page.evaluate(() => {
        return document.querySelector('.tour__main__header .finished') !== null;
      });
      if (ended) return false;

      await this.sleep(1000);
    }

    return false;
  }

  async clickBerserk() {
    const clicked = await this.page.evaluate(() => {
      const berserkBtn = document.querySelector('.fbt.go-berserk');
      if (berserkBtn) {
        berserkBtn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('[Tournament] Berserk activated!');
    }
    return clicked;
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
