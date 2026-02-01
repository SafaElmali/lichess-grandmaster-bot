export class HumanBehavior {
  constructor(config = {}) {
    this.config = {
      moveDelay: config.moveDelay || { baseMs: 500, variance: 0.4 },
      thinkingPauses: config.thinkingPauses !== false,
      humanMouse: config.humanMouse !== false
    };
  }

  /**
   * Get a random delay using normal distribution
   * @param {number} baseMs - Base delay in milliseconds
   * @param {number} variance - Variance factor (0-1)
   * @returns {number} Delay in milliseconds
   */
  getRandomDelay(baseMs, variance = 0.4) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    // Scale to desired variance
    const scaled = baseMs + (normal * baseMs * variance);

    // Clamp to reasonable range (minimum 100ms, maximum 3x base)
    return Math.max(100, Math.min(scaled, baseMs * 3));
  }

  /**
   * Determine if bot should take a thinking pause
   * @param {number} moveNumber - Current move number
   * @returns {boolean}
   */
  shouldThink(moveNumber) {
    if (!this.config.thinkingPauses) return false;

    // More likely to "think" in critical positions (moves 10-25)
    const isCriticalPhase = moveNumber >= 10 && moveNumber <= 25;
    const baseProbability = isCriticalPhase ? 0.15 : 0.08;

    return Math.random() < baseProbability;
  }

  /**
   * Generate a random thinking pause duration
   * @returns {number} Duration in milliseconds (2-8 seconds)
   */
  getThinkingDuration() {
    return 2000 + Math.random() * 6000;
  }

  /**
   * Move mouse in a human-like bezier curve path
   * @param {Page} page - Playwright page
   * @param {Object} from - Starting position {x, y}
   * @param {Object} to - Target position {x, y}
   */
  async humanMouseMove(page, from, to) {
    // Generate bezier control points for natural curve
    const controlPoints = this.generateBezierPath(from, to);

    // Move through the path
    const steps = 15 + Math.floor(Math.random() * 10);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.bezierPoint(controlPoints, t);

      await page.mouse.move(point.x, point.y);

      // Small random delay between movements
      await this.sleep(5 + Math.random() * 15);
    }

    // Click at the from position
    await page.mouse.click(from.x, from.y);
    await this.sleep(30 + Math.random() * 50);

    // Generate new path to destination
    const pathToTarget = this.generateBezierPath(from, to);
    const stepsToTarget = 12 + Math.floor(Math.random() * 8);

    for (let i = 0; i <= stepsToTarget; i++) {
      const t = i / stepsToTarget;
      const point = this.bezierPoint(pathToTarget, t);

      await page.mouse.move(point.x, point.y);
      await this.sleep(5 + Math.random() * 15);
    }

    // Click at destination
    await page.mouse.click(to.x, to.y);
  }

  /**
   * Generate bezier curve control points for natural mouse movement
   * @param {Object} from - Start point
   * @param {Object} to - End point
   * @returns {Array} Array of 4 control points
   */
  generateBezierPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Random offset for control points (creates curve)
    const offset1 = {
      x: dx * (0.2 + Math.random() * 0.3),
      y: dy * (0.1 + Math.random() * 0.3) + (Math.random() - 0.5) * 50
    };

    const offset2 = {
      x: dx * (0.6 + Math.random() * 0.3),
      y: dy * (0.6 + Math.random() * 0.3) + (Math.random() - 0.5) * 50
    };

    return [
      from,
      { x: from.x + offset1.x, y: from.y + offset1.y },
      { x: from.x + offset2.x, y: from.y + offset2.y },
      to
    ];
  }

  /**
   * Calculate point on cubic bezier curve
   * @param {Array} points - 4 control points
   * @param {number} t - Parameter (0-1)
   * @returns {Object} Point {x, y}
   */
  bezierPoint(points, t) {
    const [p0, p1, p2, p3] = points;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  /**
   * Add random micro-jitter to simulate hand tremor
   * @param {Object} point - Point {x, y}
   * @param {number} amount - Maximum jitter in pixels
   * @returns {Object} Jittered point
   */
  addJitter(point, amount = 2) {
    return {
      x: point.x + (Math.random() - 0.5) * amount * 2,
      y: point.y + (Math.random() - 0.5) * amount * 2
    };
  }

  /**
   * Simulate human-like typing speed variations
   * @param {Page} page - Playwright page
   * @param {string} text - Text to type
   */
  async humanType(page, text) {
    for (const char of text) {
      await page.keyboard.type(char);
      // Variable delay between keystrokes (50-150ms)
      await this.sleep(50 + Math.random() * 100);
    }
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
