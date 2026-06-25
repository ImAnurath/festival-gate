import { describe, it, expect } from "vitest";
import { EVENT } from "./event";

describe("EVENT.gallery", () => {
  it("has exactly 5 items", () => {
    expect(EVENT.gallery).toHaveLength(5);
  });

  it("starts with the program image and ends with the wide banner", () => {
    expect(EVENT.gallery[0]).toMatchObject({
      type: "image",
      src: "/venue/kindzi-fest-program.jpg",
    });
    const last = EVENT.gallery[EVENT.gallery.length - 1];
    expect(last).toMatchObject({ type: "image", src: "/venue/bahce-manzara.jpg" });
    expect((last as { wide?: boolean }).wide).toBe(true);
  });

  it("has exactly one wide image", () => {
    const wide = EVENT.gallery.filter(
      (g) => g.type === "image" && "wide" in g && g.wide,
    );
    expect(wide).toHaveLength(1);
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
