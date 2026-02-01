import { spawn } from 'child_process';
import { createInterface } from 'readline';

export class StockfishEngine {
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

  setDepth(depth) {
    this.depth = depth;
    console.log(`[Engine] Depth set to ${depth}`);
  }

  stop() {
    if (this.process) {
      this.send('quit');
      this.process.kill();
    }
  }
}
