export class TournamentMode {
  constructor(controller, config) {
    this.controller = controller;
    this.config = {
      url: config.url,
      autoBerserk: config.autoBerserk || false
    };
    this.tournamentId = this.extractTournamentId(config.url);
  }

  extractTournamentId(url) {
    const match = url?.match(/lichess\.org\/tournament\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  async joinTournament() {
    if (!this.config.url) {
      console.log('[Tournament] No tournament URL configured');
      return false;
    }

    return await this.controller.joinTournament(this.config.url);
  }

  async isTournamentActive() {
    return await this.controller.isTournamentActive();
  }

  async waitForPairing(timeout = 120000) {
    return await this.controller.waitForTournamentPairing(timeout);
  }

  async berserk() {
    if (this.config.autoBerserk) {
      await this.controller.sleep(500);
      return await this.controller.clickBerserk();
    }
    return false;
  }

  async returnToTournament() {
    if (this.config.url) {
      await this.controller.page.goto(this.config.url);
      await this.controller.sleep(2000);
    }
  }

  async getTournamentStatus() {
    return await this.controller.page.evaluate(() => {
      const header = document.querySelector('.tour__main__header');
      if (!header) return null;

      const name = document.querySelector('.tour__main__header__title')?.textContent?.trim();
      const clock = document.querySelector('.tour__main__header .clock')?.textContent?.trim();
      const finished = !!document.querySelector('.tour__main__header .finished');

      const standing = document.querySelector('.tour__standing tr.me');
      const rank = standing?.querySelector('td:first-child')?.textContent?.trim();
      const score = standing?.querySelector('td.total')?.textContent?.trim();

      return {
        name,
        timeRemaining: clock,
        finished,
        myRank: rank,
        myScore: score
      };
    });
  }
}
