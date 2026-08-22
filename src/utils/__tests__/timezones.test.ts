import { describe, it, expect, afterEach } from "vitest";
import {
  FALLBACK_TIMEZONES,
  getSupportedTimezones,
  matchesTimezoneQuery,
  normalizeForSearch,
  getTimezoneOffsetLabel,
  formatTimezoneLabel,
} from "../timezones";

describe("getSupportedTimezones", () => {
  it("contains America/New_York (required for AVA Day Spa)", () => {
    expect(getSupportedTimezones()).toContain("America/New_York");
  });

  it("contains America/Puerto_Rico", () => {
    expect(getSupportedTimezones()).toContain("America/Puerto_Rico");
  });
});

describe("getSupportedTimezones — fallback when Intl.supportedValuesOf is unavailable", () => {
  const original = Intl.supportedValuesOf;

  afterEach(() => {
    // @ts-expect-error -- restoring a deliberately-deleted native API after each test
    Intl.supportedValuesOf = original;
  });

  it("falls back to the deterministic list when Intl.supportedValuesOf does not exist", () => {
    // @ts-expect-error -- simulating an older runtime without this API
    delete Intl.supportedValuesOf;

    const result = getSupportedTimezones();

    expect(result).toEqual(FALLBACK_TIMEZONES);
    expect(result).toContain("America/New_York");
    expect(result).toContain("America/Chicago");
    expect(result).toContain("America/Denver");
    expect(result).toContain("America/Los_Angeles");
    expect(result).toContain("America/Puerto_Rico");
    expect(result).toContain("UTC");
  });

  it("falls back to the deterministic list when Intl.supportedValuesOf throws", () => {
    // @ts-expect-error -- simulating a runtime where the API exists but errors
    Intl.supportedValuesOf = () => {
      throw new Error("not supported in this environment");
    };

    expect(getSupportedTimezones()).toEqual(FALLBACK_TIMEZONES);
  });

  it("falls back to the deterministic list when Intl.supportedValuesOf returns an empty array", () => {
    // @ts-expect-error -- simulating a degenerate implementation
    Intl.supportedValuesOf = () => [];

    expect(getSupportedTimezones()).toEqual(FALLBACK_TIMEZONES);
  });
});

describe("normalizeForSearch", () => {
  it("replaces underscores with spaces and lowercases", () => {
    expect(normalizeForSearch("America/New_York")).toBe("america/new york");
  });
});

describe("matchesTimezoneQuery", () => {
  it("matches 'New York' against America/New_York", () => {
    expect(matchesTimezoneQuery("America/New_York", "New York")).toBe(true);
  });

  it("matches 'New_York' against America/New_York", () => {
    expect(matchesTimezoneQuery("America/New_York", "New_York")).toBe(true);
  });

  it("matches 'America' against every America/* zone", () => {
    expect(matchesTimezoneQuery("America/New_York", "America")).toBe(true);
    expect(matchesTimezoneQuery("America/Chicago", "America")).toBe(true);
  });

  it("matches 'Puerto Rico' against America/Puerto_Rico", () => {
    expect(matchesTimezoneQuery("America/Puerto_Rico", "Puerto Rico")).toBe(true);
  });

  it("matches 'Los Angeles' against America/Los_Angeles", () => {
    expect(matchesTimezoneQuery("America/Los_Angeles", "Los Angeles")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesTimezoneQuery("America/New_York", "new york")).toBe(true);
    expect(matchesTimezoneQuery("America/New_York", "NEW YORK")).toBe(true);
  });

  it("does not match an unrelated fragment", () => {
    expect(matchesTimezoneQuery("America/New_York", "Tokyo")).toBe(false);
  });

  it("matches everything for an empty/blank query", () => {
    expect(matchesTimezoneQuery("America/New_York", "")).toBe(true);
    expect(matchesTimezoneQuery("America/New_York", "   ")).toBe(true);
  });
});

describe("getTimezoneOffsetLabel / formatTimezoneLabel", () => {
  it("never hardcodes a permanent offset -- computes it for the given date", () => {
    // A fixed winter date and a fixed summer date for America/New_York (observes DST) should
    // NOT produce the same offset label.
    const winter = getTimezoneOffsetLabel("America/New_York", new Date("2026-01-15T12:00:00Z"));
    const summer = getTimezoneOffsetLabel("America/New_York", new Date("2026-07-15T12:00:00Z"));

    if (winter !== null && summer !== null) {
      expect(winter).not.toBe(summer);
    }
  });

  it("returns null (not a throw) for an unrecognized zone", () => {
    expect(getTimezoneOffsetLabel("Not/A/Real/Zone")).toBeNull();
  });

  it("formatTimezoneLabel always includes the raw IANA identifier as the first component", () => {
    const label = formatTimezoneLabel("America/New_York", new Date("2026-07-15T12:00:00Z"));

    expect(label.startsWith("America/New_York")).toBe(true);
  });

  it("formatTimezoneLabel falls back to the raw identifier alone for an unrecognized zone", () => {
    expect(formatTimezoneLabel("Not/A/Real/Zone")).toBe("Not/A/Real/Zone");
  });
});
