// conventional-commits.test.ts

import { describe, it, expect } from "vitest";
import {
	parseConventionalCommit,
	getVersionType,
	getVersionTypeNumber,
	getVersionTypeFromNumber,
} from "./conventional-commits";

describe("parseConventionalCommit", () => {
	it("parses a simple commit without scope", () => {
		const result = parseConventionalCommit("feat: my message");
		expect(result).toEqual({
			type: "feat",
			scope: undefined,
			breakingChange: false,
			message: "my message",
		});
	});

	it("parses a commit with scope", () => {
		const result = parseConventionalCommit("feat(subject): my message");
		expect(result).toEqual({
			type: "feat",
			scope: "subject",
			breakingChange: false,
			message: "my message",
		});
	});

	it("parses a breaking commit without scope", () => {
		const result = parseConventionalCommit("feat!: breaking change");
		expect(result).toEqual({
			type: "feat",
			scope: undefined,
			breakingChange: true,
			message: "breaking change",
		});
	});

	it("parses a breaking commit with scope", () => {
		const result = parseConventionalCommit("feat(subject)!: breaking subject");
		expect(result).toEqual({
			type: "feat",
			scope: "subject",
			breakingChange: true,
			message: "breaking subject",
		});
	});

	it("returns commit message when pattern does not match", () => {
		const commitMsg = "Random commit message without pattern";
		const result = parseConventionalCommit(commitMsg);
		expect(result).toEqual({
			type: undefined,
			scope: undefined,
			breakingChange: false,
			message: commitMsg,
		});
	});

	it("detects BREAKING CHANGE in commit body", () => {
		const commitMsg = "fix: a fix\n\nBREAKING CHANGE: completely changed behavior";
		const result = parseConventionalCommit(commitMsg);
		expect(result.breakingChange).toBe(true);
	});
});

describe("getVersionType", () => {
	it("returns major when breakingChange is true", () => {
		const commit = { type: "feat", scope: undefined, breakingChange: true, message: "msg" };
		expect(getVersionType(commit)).toBe("major");
	});

	it("returns minor for feat commits", () => {
		const commit = { type: "feat", scope: undefined, breakingChange: false, message: "msg" };
		expect(getVersionType(commit)).toBe("minor");
	});

	it("returns patch for fix commits", () => {
		const commit = { type: "fix", scope: undefined, breakingChange: false, message: "msg" };
		expect(getVersionType(commit)).toBe("patch");
	});

	it("returns none for docs and chore commits", () => {
		const commitDocs = { type: "docs", scope: undefined, breakingChange: false, message: "msg" };
		const commitChore = { type: "chore", scope: undefined, breakingChange: false, message: "msg" };
		expect(getVersionType(commitDocs)).toBe("none");
		expect(getVersionType(commitChore)).toBe("none");
	});

	it("returns patch for unknown commit types", () => {
		const commit = { type: "other", scope: undefined, breakingChange: false, message: "msg" };
		expect(getVersionType(commit)).toBe("patch");
	});
});

describe("getVersionTypeNumber", () => {
	it("returns correct numeric values", () => {
		expect(getVersionTypeNumber("none")).toBe(0);
		expect(getVersionTypeNumber("patch")).toBe(1);
		expect(getVersionTypeNumber("minor")).toBe(2);
		expect(getVersionTypeNumber("major")).toBe(3);
	});
});

describe("getVersionTypeFromNumber", () => {
	it("returns correct version type for valid numbers", () => {
		expect(getVersionTypeFromNumber(0)).toBe("none");
		expect(getVersionTypeFromNumber(1)).toBe("patch");
		expect(getVersionTypeFromNumber(2)).toBe("minor");
		expect(getVersionTypeFromNumber(3)).toBe("major");
	});

	it("throws an error for invalid numbers", () => {
		expect(() => getVersionTypeFromNumber(4)).toThrow("Invalid version type number: 4");
		expect(() => getVersionTypeFromNumber(-1)).toThrow("Invalid version type number: -1");
	});
});
