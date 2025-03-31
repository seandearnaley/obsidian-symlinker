import { describe, expect, it } from "vitest";

// These are simple tests to verify our testing setup and JavaScript functionality
describe("JavaScript Fundamentals", () => {
	describe("Basic Operations", () => {
		it("should correctly perform arithmetic operations", () => {
			expect(1 + 1).toBe(2);
			expect(5 - 2).toBe(3);
			expect(2 * 3).toBe(6);
			expect(8 / 4).toBe(2);
			expect(10 % 3).toBe(1); // Modulo
			expect(2 ** 3).toBe(8); // Exponentiation
		});

		it("should correctly compare values", () => {
			expect(5 > 3).toBe(true);
			expect(5 < 3).toBe(false);
			expect(5 >= 4).toBe(true);
			expect(4 <= 5).toBe(true);
			expect(5 === Number('5')).toBe(true);
			expect(5 === "5").toBe(false);
			expect(5 !== "5").toBe(true);
		});

		it("should correctly perform logical operations", () => {
			expect(true && true).toBe(true);
			expect(true && false).toBe(false);
			expect(true || false).toBe(true);
			expect(false || false).toBe(false);
			expect(!true).toBe(false);
			expect(!false).toBe(true);
		});
	});

	describe("String Operations", () => {
		it("should correctly manipulate strings", () => {
			expect("hello " + "world").toBe("hello world");
			expect("hello world".toUpperCase()).toBe("HELLO WORLD");
			expect("HELLO WORLD".toLowerCase()).toBe("hello world");
			expect("hello world".substring(0, 5)).toBe("hello");
			expect("hello world".split(" ")).toEqual(["hello", "world"]);
			expect("  hello world  ".trim()).toBe("hello world");
			expect("hello world".includes("world")).toBe(true);
			expect("hello world".startsWith("hello")).toBe(true);
			expect("hello world".endsWith("world")).toBe(true);
			expect("hello world".replace("world", "universe")).toBe("hello universe");
		});
	});

	describe("Array Operations", () => {
		it("should correctly manipulate arrays", () => {
			const arr = [1, 2, 3];
			expect(arr.length).toBe(3);
			expect(arr.includes(2)).toBe(true);
			expect(arr.indexOf(2)).toBe(1);
			expect(arr.map((x) => x * 2)).toEqual([2, 4, 6]);
			expect(arr.filter((x) => x > 1)).toEqual([2, 3]);
			expect(arr.reduce((sum, x) => sum + x, 0)).toBe(6);
			expect(arr.join(", ")).toBe("1, 2, 3");
			expect([...arr, 4]).toEqual([1, 2, 3, 4]);
			expect([0, ...arr]).toEqual([0, 1, 2, 3]);
		});
	});

	describe("Object Operations", () => {
		it("should correctly manipulate objects", () => {
			const obj = { a: 1, b: 2, c: 3 };
			expect(Object.keys(obj)).toEqual(["a", "b", "c"]);
			expect(Object.values(obj)).toEqual([1, 2, 3]);
			expect(Object.entries(obj)).toEqual([
				["a", 1],
				["b", 2],
				["c", 3],
			]);
			expect({ ...obj, d: 4 }).toEqual({ a: 1, b: 2, c: 3, d: 4 });
			expect(Object.hasOwn(obj, "a")).toBe(true);
			expect(Object.hasOwn(obj, "d")).toBe(false);
		});
	});

	describe("Async Operations", () => {
		it("should resolve promises", async () => {
			const promise = Promise.resolve("hello");
			await expect(promise).resolves.toBe("hello");
		});

		it("should reject promises", async () => {
			const promise = Promise.reject(new Error("error"));
			await expect(promise).rejects.toThrow("error");
		});

		it("should handle async/await", async () => {
			const result = await Promise.resolve("hello");
			expect(result).toBe("hello");
		});
	});
});
