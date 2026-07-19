import { describe, it, expect } from "vitest";
import { EVENT } from "./event";

describe("EVENT.gallery", () => {
  it("has exactly 4 items", () => {
    expect(EVENT.gallery).toHaveLength(4);
  });

  it("starts with the promo video", () => {
    expect(EVENT.gallery[0]).toMatchObject({
      type: "video",
      src: "/venue/fest-program.mp4",
    });
  });

  it("has 4 videos, each with a poster", () => {
    const videos = EVENT.gallery.filter((g) => g.type === "video");
    expect(videos).toHaveLength(4);
    for (const v of videos) {
      expect((v as { poster?: string }).poster).toBeTruthy();
    }
  });

  it("references none of the removed stills", () => {
    const removed = ["tesis-kus-bakisi", "sisli-bahce", "kindzi-fest-ezgi", "ic-mekan", "alan"];
    const srcs = EVENT.gallery.map((g) => g.src).join(" ");
    for (const name of removed) expect(srcs).not.toContain(name);
  });
});
