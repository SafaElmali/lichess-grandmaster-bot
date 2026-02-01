export class TelegramBot {
  constructor(config) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.bot = null; // Reference to LichessBot for commands
    this.polling = false;
    this.lastUpdateId = 0;
  }

  async start(bot) {
    this.bot = bot;
    await this.send('Bot started! Use /help to see available commands.');
    this.startPolling();
  }

  stop() {
    this.polling = false;
  }

  // ========================================
  // Message Sending
  // ========================================

  async send(message) {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        console.error('[Telegram] Failed to send message:', await response.text());
      }
    } catch (error) {
      console.error('[Telegram] Error sending message:', error.message);
    }
  }

  async notifyGameEnd(result, opponent, url) {
    const emoji = {
      win: '🏆',
      loss: '😔',
      draw: '🤝',
      aborted: '❌'
    }[result] || '🎮';

    const message = `${emoji} <b>Game ${result}</b> vs ${opponent}\n${url}`;
    await this.send(message);
  }

  async notifySessionStats(stats, gamesPlayed) {
    const winRate = gamesPlayed > 0
      ? ((stats.wins / gamesPlayed) * 100).toFixed(1)
      : 0;

    const message = [
      '📊 <b>Session Statistics</b>',
      '',
      `Games: ${gamesPlayed}`,
      `Wins: ${stats.wins}`,
      `Losses: ${stats.losses}`,
      `Draws: ${stats.draws}`,
      `Win Rate: ${winRate}%`
    ].join('\n');

    await this.send(message);
  }

  // ========================================
  // Command Polling
  // ========================================

  startPolling() {
    this.polling = true;
    this.pollUpdates();
  }

  async pollUpdates() {
    while (this.polling) {
      try {
        const response = await fetch(
          `${this.baseUrl}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`
        );

        if (!response.ok) {
          await this.sleep(5000);
          continue;
        }

        const data = await response.json();

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id;

            if (update.message?.text) {
              await this.handleMessage(update.message);
            }
          }
        }
      } catch (error) {
        console.error('[Telegram] Polling error:', error.message);
        await this.sleep(5000);
      }
    }
  }

  async handleMessage(message) {
    const text = message.text.trim();

    // Only process commands (starting with /)
    if (!text.startsWith('/')) return;

    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    console.log(`[Telegram] Received command: ${command} ${args.join(' ')}`);

    await this.handleCommand(command, args);
  }

  // ========================================
  // Command Handlers
  // ========================================

  async handleCommand(command, args) {
    switch (command) {
      case '/help':
        await this.cmdHelp();
        break;

      case '/status':
        await this.cmdStatus();
        break;

      case '/config':
        await this.cmdConfig();
        break;

      case '/stats':
        await this.cmdStats();
        break;

      case '/set':
        await this.cmdSet(args);
        break;

      case '/stop':
        await this.cmdStop();
        break;

      case '/start':
        await this.cmdStart();
        break;

      default:
        await this.send(`Unknown command: ${command}\nUse /help to see available commands.`);
    }
  }

  async cmdHelp() {
    const help = [
      '🤖 <b>Lichess Bot Commands</b>',
      '',
      '/status - Current bot status',
      '/stats - Session statistics',
      '/config - Show current configuration',
      '/set depth [10-25] - Change engine depth',
      '/set time [1+0|3+0|5+0|etc] - Change time control',
      '/set maxgames [N] - Set max games (0 = unlimited)',
      '/stop - Pause after current game',
      '/start - Resume playing'
    ].join('\n');

    await this.send(help);
  }

  async cmdStatus() {
    if (!this.bot) {
      await this.send('Bot not initialized');
      return;
    }

    const status = this.bot.getStatus();
    const statusEmoji = status.paused ? '⏸️' : '▶️';

    const message = [
      `${statusEmoji} <b>Bot Status</b>`,
      '',
      `State: ${status.paused ? 'Paused' : 'Running'}`,
      `Mode: ${status.mode}`,
      `Time Control: ${status.timeControl}`,
      `Engine Depth: ${status.engineDepth}`,
      '',
      `Games Played: ${status.gamesPlayed}`,
      `Win Rate: ${status.winRate}%`,
      `W/L/D: ${status.stats.wins}/${status.stats.losses}/${status.stats.draws}`
    ].join('\n');

    await this.send(message);
  }

  async cmdConfig() {
    if (!this.bot) {
      await this.send('Bot not initialized');
      return;
    }

    const config = this.bot.config;
    const message = [
      '⚙️ <b>Configuration</b>',
      '',
      `Time Control: ${config.game.timeControl}`,
      `Max Games: ${config.game.maxGames || 'unlimited'}`,
      `Engine Depth: ${config.engine.depth}`,
      '',
      `Opening Book: ${config.openingBook?.enabled ? 'enabled' : 'disabled'}`,
      `Anti-Detection: ${config.antiDetection?.enabled ? 'enabled' : 'disabled'}`,
      `Tournament Mode: ${config.tournament?.enabled ? 'enabled' : 'disabled'}`
    ].join('\n');

    await this.send(message);
  }

  async cmdStats() {
    if (!this.bot) {
      await this.send('Bot not initialized');
      return;
    }

    await this.notifySessionStats(this.bot.stats, this.bot.gamesPlayed);
  }

  async cmdSet(args) {
    if (!this.bot) {
      await this.send('Bot not initialized');
      return;
    }

    if (args.length < 2) {
      await this.send('Usage: /set [depth|time|maxgames] [value]');
      return;
    }

    const setting = args[0].toLowerCase();
    const value = args[1];

    switch (setting) {
      case 'depth': {
        const depth = parseInt(value);
        if (isNaN(depth) || depth < 5 || depth > 30) {
          await this.send('Invalid depth. Use a value between 5 and 30.');
          return;
        }
        this.bot.engine.setDepth(depth);
        this.bot.config.engine.depth = depth;
        await this.send(`Engine depth set to ${depth}`);
        break;
      }

      case 'time': {
        if (!/^\d+\+\d+$/.test(value)) {
          await this.send('Invalid time control. Use format like 5+0 or 3+2.');
          return;
        }
        this.bot.config.game.timeControl = value;
        await this.send(`Time control set to ${value}`);
        break;
      }

      case 'maxgames': {
        const maxGames = parseInt(value);
        if (isNaN(maxGames) || maxGames < 0) {
          await this.send('Invalid value. Use 0 for unlimited or a positive number.');
          return;
        }
        this.bot.config.game.maxGames = maxGames;
        await this.send(`Max games set to ${maxGames === 0 ? 'unlimited' : maxGames}`);
        break;
      }

      default:
        await this.send(`Unknown setting: ${setting}\nAvailable: depth, time, maxgames`);
    }
  }

  async cmdStop() {
    if (!this.bot) {
      await this.send('Bot not initialized');
      return;
    }

    this.bot.pause();
    await this.send('⏸️ Bot will stop after the current game');
  }

  async cmdStart() {
    if (!this.bot) {
      await this.send('Bot not initialized');
      return;
    }

    this.bot.resume();
    await this.send('▶️ Bot resumed');
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
