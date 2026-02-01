import { readFileSync, existsSync } from 'fs';
import { Chess } from 'chess.js';

export class OpeningBook {
  constructor(config = {}) {
    this.config = config;
    this.maxMoves = config.maxMoves || 10;
    this.book = {};

    this.loadBook();
  }

  loadBook() {
    const bookPath = './data/openings.json';

    if (!existsSync(bookPath)) {
      console.log('[Book] No opening book found, using built-in openings');
      this.book = this.getBuiltInOpenings();
      return;
    }

    try {
      const data = readFileSync(bookPath, 'utf-8');
      this.book = JSON.parse(data);
      console.log(`[Book] Loaded ${Object.keys(this.book).length} positions`);
    } catch (error) {
      console.error('[Book] Error loading opening book:', error.message);
      this.book = this.getBuiltInOpenings();
    }
  }

  getBuiltInOpenings() {
    // Common openings with weighted moves (higher weight = more likely to be chosen)
    return {
      // Starting position
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': [
        { move: 'e2e4', weight: 100 },  // King's Pawn
        { move: 'd2d4', weight: 80 },   // Queen's Pawn
        { move: 'c2c4', weight: 40 },   // English
        { move: 'g1f3', weight: 30 }    // Reti
      ],

      // After 1.e4
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -': [
        { move: 'e7e5', weight: 100 },  // Open Game
        { move: 'c7c5', weight: 90 },   // Sicilian
        { move: 'e7e6', weight: 60 },   // French
        { move: 'c7c6', weight: 50 }    // Caro-Kann
      ],

      // After 1.e4 e5
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': [
        { move: 'g1f3', weight: 100 },  // King's Knight
        { move: 'f1c4', weight: 40 },   // Bishop's Opening
        { move: 'b1c3', weight: 30 }    // Vienna
      ],

      // After 1.e4 e5 2.Nf3
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -': [
        { move: 'b8c6', weight: 100 },  // Knight's Defence
        { move: 'g8f6', weight: 60 },   // Petroff
        { move: 'd7d6', weight: 30 }    // Philidor
      ],

      // After 1.e4 e5 2.Nf3 Nc6
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -': [
        { move: 'f1b5', weight: 100 },  // Ruy Lopez
        { move: 'f1c4', weight: 70 },   // Italian
        { move: 'd2d4', weight: 40 }    // Scotch
      ],

      // Ruy Lopez: 1.e4 e5 2.Nf3 Nc6 3.Bb5
      'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -': [
        { move: 'a7a6', weight: 100 },  // Morphy Defense
        { move: 'g8f6', weight: 60 },   // Berlin
        { move: 'f8c5', weight: 30 }    // Classical
      ],

      // Italian: 1.e4 e5 2.Nf3 Nc6 3.Bc4
      'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -': [
        { move: 'f8c5', weight: 100 },  // Giuoco Piano
        { move: 'g8f6', weight: 80 },   // Two Knights
        { move: 'f8e7', weight: 20 }    // Hungarian
      ],

      // After 1.d4
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -': [
        { move: 'd7d5', weight: 100 },  // Closed Game
        { move: 'g8f6', weight: 80 },   // Indian Defense
        { move: 'f7f5', weight: 20 }    // Dutch
      ],

      // After 1.d4 d5
      'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -': [
        { move: 'c2c4', weight: 100 },  // Queen's Gambit
        { move: 'g1f3', weight: 40 },
        { move: 'c1f4', weight: 30 }    // London
      ],

      // Queen's Gambit: 1.d4 d5 2.c4
      'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -': [
        { move: 'e7e6', weight: 100 },  // QGD
        { move: 'd5c4', weight: 70 },   // QGA
        { move: 'c7c6', weight: 60 }    // Slav
      ],

      // After 1.d4 Nf6
      'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -': [
        { move: 'c2c4', weight: 100 },
        { move: 'g1f3', weight: 60 },
        { move: 'c1f4', weight: 40 }
      ],

      // Sicilian: 1.e4 c5
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': [
        { move: 'g1f3', weight: 100 },  // Open Sicilian
        { move: 'b1c3', weight: 50 },   // Closed Sicilian
        { move: 'c2c3', weight: 30 }    // Alapin
      ],

      // Sicilian Open: 1.e4 c5 2.Nf3
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -': [
        { move: 'd7d6', weight: 100 },  // Najdorf/Dragon
        { move: 'b8c6', weight: 80 },
        { move: 'e7e6', weight: 70 }    // Scheveningen
      ],

      // French: 1.e4 e6
      'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': [
        { move: 'd2d4', weight: 100 },
        { move: 'd2d3', weight: 20 }    // King's Indian Attack
      ],

      // French: 1.e4 e6 2.d4
      'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -': [
        { move: 'd7d5', weight: 100 }
      ],

      // Caro-Kann: 1.e4 c6
      'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': [
        { move: 'd2d4', weight: 100 },
        { move: 'b1c3', weight: 40 }
      ]
    };
  }

  getMove(fen, moveNumber) {
    if (moveNumber > this.maxMoves) {
      return null;
    }

    // Normalize FEN (ignore halfmove and fullmove clocks for lookup)
    const normalizedFen = this.normalizeFen(fen);

    const moves = this.book[normalizedFen];
    if (!moves || moves.length === 0) {
      return null;
    }

    return this.weightedRandom(moves);
  }

  normalizeFen(fen) {
    // Keep only position, turn, castling, and en passant
    const parts = fen.split(' ');
    return parts.slice(0, 4).join(' ');
  }

  weightedRandom(moves) {
    const totalWeight = moves.reduce((sum, m) => sum + m.weight, 0);
    let random = Math.random() * totalWeight;

    for (const move of moves) {
      random -= move.weight;
      if (random <= 0) {
        return move.move;
      }
    }

    return moves[0].move;
  }

  // Utility to convert SAN to UCI (for adding moves to book)
  sanToUci(san, fen) {
    const chess = new Chess(fen);
    try {
      const move = chess.move(san);
      return move.from + move.to + (move.promotion || '');
    } catch {
      return null;
    }
  }
}
