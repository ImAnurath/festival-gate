import { describe, it, expect } from "vitest";
import { EVENT } from "./event";

describe("EVENT.gallery", () => {
  it("has exactly 5 items", () => {
    expect(EVENT.gallery).toHaveLength(5);
  });

  it("has exactly one featured image", () => {
    const featured = EVENT.gallery.filter(
      (g) => g.type === "image" && "featured" in g && g.featured,
    );
    expect(featured).toHaveLength(1);
  });

  it("has 3 videos, each with a poster", () => {
    const videos = EVENT.gallery.filter((g) => g.type === "video");
    expect(videos).toHaveLength(3);
    for (const v of videos) {
      expect((v as { poster?: string }).poster).toBeTruthy();
    }
  });

  it("references none of the removed stills", () => {
    const removed = ["tesis-kus-bakisi", "sisli-bahce", "kindzi-fest-ezgi", "ic-mekan"];
    const srcs = EVENT.gallery.map((g) => g.src).join(" ");
    for (const name of removed) expect(srcs).not.toContain(name);
  });
});
