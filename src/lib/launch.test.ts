import { describe, expect, it } from "vitest";
import { currentStep, launchPercent, nextStatus } from "./launch";

describe("launchPercent", () => {
  it("counts done fully and busy for half", () => {
    expect(launchPercent([{ status: "done" }, { status: "busy" }, { status: "todo" }, { status: "todo" }])).toBe(38);
  });

  it("leaves 'laten zo' out", () => {
    expect(launchPercent([{ status: "done" }, { status: "skip" }])).toBe(100);
  });

  it("is 0 with nothing to count", () => {
    expect(launchPercent([])).toBe(0);
  });
});

describe("nextStatus", () => {
  it("goes te doen → bezig → klaar → te doen", () => {
    expect(nextStatus("todo")).toBe("busy");
    expect(nextStatus("busy")).toBe("done");
    expect(nextStatus("done")).toBe("todo");
    expect(nextStatus("skip")).toBe("todo");
  });
});

describe("currentStep", () => {
  it("is the first step with something open", () => {
    const items = [
      { step: 1, status: "done" },
      { step: 2, status: "skip" },
      { step: 3, status: "busy" },
      { step: 4, status: "todo" },
    ];
    expect(currentStep(items)).toBe(3);
  });

  it("is none when everything is done", () => {
    expect(currentStep([{ step: 1, status: "done" }])).toBeNull();
  });
});
