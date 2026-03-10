import { describe, it, expect } from "vitest";
import { getCountryFromTimezone, getCountryFlagUrl } from "../country-utils";

describe("getCountryFromTimezone", () => {
  it("returns country for a known timezone", () => {
    const result = getCountryFromTimezone("America/New_York");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("US");
    expect(result!.name).toBe("United States of America");
  });

  it("returns country for another timezone", () => {
    const result = getCountryFromTimezone("Europe/London");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("GB");
  });

  it("returns country for Asia/Tokyo", () => {
    const result = getCountryFromTimezone("Asia/Tokyo");
    expect(result).not.toBeNull();
    expect(result!.code).toBe("JP");
  });

  it("returns null for undefined timezone", () => {
    expect(getCountryFromTimezone(undefined)).toBeNull();
  });

  it("returns null for empty string timezone", () => {
    // Empty string returns null since getTimezone returns undefined
    expect(getCountryFromTimezone("")).toBeNull();
  });

  it("returns null for invalid timezone", () => {
    expect(getCountryFromTimezone("Invalid/Timezone")).toBeNull();
  });
});

describe("getCountryFlagUrl", () => {
  it("generates correct URL for US", () => {
    expect(getCountryFlagUrl("US")).toBe("https://flagcdn.com/w40/us.png");
  });

  it("generates correct URL for GB", () => {
    expect(getCountryFlagUrl("GB")).toBe("https://flagcdn.com/w40/gb.png");
  });

  it("lowercases the country code", () => {
    expect(getCountryFlagUrl("JP")).toBe("https://flagcdn.com/w40/jp.png");
  });
});
