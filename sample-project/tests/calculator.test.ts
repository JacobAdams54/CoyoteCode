import { describe, expect, it } from "vitest";

import { add, divide, multiply, subtract } from "../src/calculator";

describe("calculator", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("subtracts two numbers", () => {
    expect(subtract(8, 5)).toBe(3);
  });

  it("multiplies two numbers", () => {
    expect(multiply(4, 6)).toBe(24);
  });

  it("divides two numbers", () => {
    expect(divide(10, 2)).toBe(5);
  });
});
