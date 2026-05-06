import { describe, it, expect, beforeEach } from "vitest";
import { getJournalEntries, insertJournalEntry, getJournalReplay } from "./trade-journal";

describe("Trade Journal SQLite Integration", () => {
  beforeEach(() => {
    // Optionally setup an in-memory DB or clear the test table.
  });

  it("should securely insert a trade journal entry with session and risk score", () => {
    const entryData = {
      symbol: "TEST-BTC",
      side: "BUY",
      qty: "0.5",
      price: "50000",
      status: "EXECUTED",
      mode: "TEST",
      tradeSessionId: "session-12345",
      exchangeOrderId: "order-9999",
      riskScore: 0.95
    };

    const id = insertJournalEntry(entryData);
    expect(id).toBeDefined();

    const entries = getJournalEntries();
    expect(Array.isArray(entries)).toBe(true);

    const inserted = entries.find(e => e.id === id);
    expect(inserted).toBeDefined();
    expect(inserted?.symbol).toBe("TEST-BTC");
    expect(inserted?.tradeSessionId).toBe("session-12345");
    expect(inserted?.exchangeOrderId).toBe("order-9999");
    expect(inserted?.riskScore).toBe(0.95);
  });

  it("should retrieve entries for a specific trade session in ASC order", () => {
    // Insert some seeded data
    const sessionId = "replay-sess-001";
    
    insertJournalEntry({ symbol: "TEST-ETH", side: "BUY", qty: "1", price: "2000", status: "EXECUTED", mode: "TEST", tradeSessionId: sessionId });
    insertJournalEntry({ symbol: "TEST-ETH", side: "SELL", qty: "1", price: "2050", status: "EXECUTED", mode: "TEST", tradeSessionId: sessionId });

    const replayEntries = getJournalReplay(sessionId);
    
    expect(Array.isArray(replayEntries)).toBe(true);
    expect(replayEntries.length).toBeGreaterThanOrEqual(2);
    
    // Check that all returned entries belong to the correct session
    const allMatch = replayEntries.every(e => e.tradeSessionId === sessionId);
    expect(allMatch).toBe(true);

    // Verify ordering by timestamp ASC (id ASC generally maps to timestamp ASC)
    if (replayEntries.length >= 2) {
      expect(replayEntries[0].id).toBeLessThan(replayEntries[1].id);
    }
  });
});
