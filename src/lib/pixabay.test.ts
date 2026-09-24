import { describe, expect, it } from "vitest";
import { isPixabayUrl, toStockPhoto } from "./pixabay";

describe("isPixabayUrl", () => {
  it("accepts https Pixabay hosts only", () => {
    expect(isPixabayUrl("https://pixabay.com/get/abc_1280.jpg")).toBe(true);
    expect(isPixabayUrl("https://cdn.pixabay.com/photo/2020/01/01/abc_640.jpg")).toBe(true);
    expect(isPixabayUrl("http://cdn.pixabay.com/photo/abc.jpg")).toBe(false);
    expect(isPixabayUrl("https://evilpixabay.com/abc.jpg")).toBe(false);
    expect(isPixabayUrl("https://pixabay.com.evil.nl/abc.jpg")).toBe(false);
    expect(isPixabayUrl("http://169.254.169.254/latest")).toBe(false);
    expect(isPixabayUrl("not a url")).toBe(false);
  });
});

describe("toStockPhoto", () => {
  it("uses the 340px thumbnail and maps the credit", () => {
    const photo = toStockPhoto({
      id: 1,
      pageURL: "https://pixabay.com/photos/x-1/",
      tags: "huis, tuin",
      webformatURL: "https://pixabay.com/get/abc_640.jpg",
      largeImageURL: "https://pixabay.com/get/abc_1280.jpg",
      user: "Jan",
    });
    expect(photo).toEqual({
      id: 1,
      thumbUrl: "https://pixabay.com/get/abc_340.jpg",
      alt: "huis, tuin",
      photographer: "Jan",
      pageUrl: "https://pixabay.com/photos/x-1/",
    });
  });
});
