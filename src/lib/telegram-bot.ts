// =============================================================================
// GODMODE v1 — Telegram Alerting System
// Rave Organisation
// =============================================================================

export class TelegramBot {
  private enabled = false;
  private token: string | undefined;
  private chatId: string | undefined;

  constructor() {
    this.enabled = process.env['TELEGRAM_ENABLED'] === 'true';
    this.token = process.env['TELEGRAM_BOT_TOKEN'];
    this.chatId = process.env['TELEGRAM_CHAT_ID'];
  }

  /**
   * Broadcasts a message to the configured Telegram chat.
   * Fails silently in testnet/paper mode if disabled or credentials missing.
   */
  async broadcast(message: string): Promise<boolean> {
    if (!this.enabled || !this.token || !this.chatId) {
      // Silently ignore if not configured or disabled
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      const mode = process.env["LIVE_TRADING"] === "true" ? "🔴 LIVE MODE" : "🟢 TESTNET/PAPER MODE";
      const formattedMessage = `<b>🤖 RAVE GODMODE v1</b>\n<i>${mode}</i>\n\n${message}\n\n<i>Time: ${new Date().toISOString()}</i>`;
      
      const payload = {
        chat_id: this.chatId,
        text: formattedMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`[TELEGRAM] Failed to broadcast: ${response.statusText}`);
        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[TELEGRAM] Exception broadcasting message: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Status check helper for system boot
   */
  getStatus(): { enabled: boolean; configured: boolean } {
    return {
      enabled: this.enabled,
      configured: !!(this.token && this.chatId),
    };
  }
}

export const telegramBot = new TelegramBot();
