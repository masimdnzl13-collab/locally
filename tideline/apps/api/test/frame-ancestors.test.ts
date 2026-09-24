import { describe, expect, it } from "vitest";
import { DEFAULT_FRAME_ANCESTORS, frameAncestorsHeader, resolveFrameAncestors } from "../src/config/frame-ancestors.js";

describe("frame ancestors", () => {
  it("falls back to localhost when unset or blank", () => {
    expect(resolveFrameAncestors(undefined)).toEqual({ origins: DEFAULT_FRAME_ANCESTORS, isDefault: true });
    expect(resolveFrameAncestors(" , ")).toEqual({ origins: DEFAULT_FRAME_ANCESTORS, isDefault: true });
  });
  it("parses comma-separated origins", () => {
    const r = resolveFrameAncestors("http://localhost:3001, https://locally.example.com/");
    expect(r).toEqual({ origins: ["http://localhost:3001", "https://locally.example.com"], isDefault: false });
    expect(frameAncestorsHeader(r.origins)).toBe("frame-ancestors 'self' http://localhost:3001 https://locally.example.com");
  });
  it("rejects entries that are not bare origins", () => {
    expect(() => resolveFrameAncestors("locally.example.com")).toThrow(/bare origin/);
    expect(() => resolveFrameAncestors("https://locally.example.com/panel")).toThrow(/bare origin/);
  });
});
