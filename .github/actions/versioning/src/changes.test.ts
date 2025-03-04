
import { describe, it, expect, beforeEach, vi } from "vitest";
// Also import the mocked functions so we can set their implementations.
import { getRepoPath, getCommits } from "./git";
import { getProjects } from "./dotnet";
import { getLatestRelease } from "./github";
import {
	getVersionType,
	getVersionTypeNumber,
	getVersionTypeFromNumber,
	parseConventionalCommit
} from "./conventional-commits";
import { formatLocalChangelogAsMarkdown } from "./changelog";

// Mock the git module.
vi.mock("./git", () => ({
	getRepoPath: vi.fn(),
	getCommits: vi.fn()
}));

// Mock the dotnet module.
vi.mock("./dotnet", () => ({
	getProjects: vi.fn()
}));

// Mock the github module.
vi.mock("./github", () => ({
	getLatestRelease: vi.fn()
}));

// Mock the conventional-commits module.
vi.mock("./conventional-commits", () => ({
	getVersionType: vi.fn(),
	getVersionTypeNumber: vi.fn(),
	getVersionTypeFromNumber: vi.fn(),
	parseConventionalCommit: vi.fn()
}));

// Mock the utils module.
vi.mock("./util/utils", () => ({
	createMap: vi.fn(),
	groupBy: vi.fn(),
	// For maxReducer, we simply return a function that picks the maximum numeric value.
	maxReducer: vi.fn((fn: any) => (a: number, b: any) => Math.max(a, fn(b))),
	// A simple sorter by commit date.
	sortComparer: vi.fn(() => (a: any, b: any) => a.date.localeCompare(b.date))
}));

// Mock the changelog module.
vi.mock("./changelog", () => ({
	formatLocalChangelogAsMarkdown: vi.fn()
}));

import { getChangeDetails } from "./changes";



// Reset mocks before each test.
beforeEach(() => {
	vi.resetAllMocks();
});

describe("getChangeDetails", () => {
	const rootPath = "/repo";

	it("returns undefined when no projects are found", async () => {
		(getRepoPath as any).mockResolvedValue(rootPath);
		(getProjects as any).mockResolvedValue([]);

		const result = await getChangeDetails(true);
		expect(result).toBeUndefined();
	});

	it("returns undefined when no changes are found (all versionType 'none')", async () => {
		(getRepoPath as any).mockResolvedValue(rootPath);
		// Provide one project.
		const project = {
			name: "ProjectA",
			path: `${rootPath}/ProjectA.csproj`,
			version: "1.0.0"
		};
		(getProjects as any).mockResolvedValue([project]);
		// Simulate a latest release tag.
		(getLatestRelease as any).mockResolvedValue("v0.9.0");
		// Simulate no commits (thus no conventional commit bumps).
		(getCommits as any).mockResolvedValue([]);

		// Set conventional-commits mocks so that the computed bump is "none".
		(parseConventionalCommit as any).mockReturnValue({});
		(getVersionType as any).mockReturnValue("none");
		(getVersionTypeNumber as any).mockReturnValue(0);
		(getVersionTypeFromNumber as any).mockReturnValue("none");
		(formatLocalChangelogAsMarkdown as any).mockReturnValue("Changelog");

		const result = await getChangeDetails(true);
		expect(result).toBeUndefined();
	});

	it("returns change details when changes are found with bumpVersion true", async () => {
		(getRepoPath as any).mockResolvedValue(rootPath);
		// Define two projects:
		// The root project is the one closest to the repo root.
		const rootProject = {
			name: "RootProject",
			path: `${rootPath}/RootProject.csproj`,
			version: "1.0.0"
		};
		const otherProject = {
			name: "OtherProject",
			path: `${rootPath}/sub/OtherProject.csproj`,
			version: "2.0.0"
		};
		(getProjects as any).mockResolvedValue([rootProject, otherProject]);
		(getLatestRelease as any).mockResolvedValue("v0.9.0");

		// Simulate one commit for each project.
		const fakeCommit = {
			date: "2023-01-01T00:00:00",
			message: "feat: something",
			sha: "abc",
			author: "Tester"
		};
		(getCommits as any).mockResolvedValue([fakeCommit]);

		// Simulate that each commit produces a "minor" bump.
		(parseConventionalCommit as any).mockReturnValue({});
		(getVersionType as any).mockReturnValue("minor");
		(getVersionTypeNumber as any).mockReturnValue(1);
		(getVersionTypeFromNumber as any).mockReturnValue("minor");
		// Let the changelog formatter return a fixed string.
		(formatLocalChangelogAsMarkdown as any).mockReturnValue("Changelog");

		const result = await getChangeDetails(true);
		expect(result).toBeDefined();
		if (result) {
			expect(result.rootPath).toBe(rootPath);
			// The root project is chosen based on proximity.
			expect(result.repository.change.name).toBe("RootProject");
			expect(result.repository.change.version).toBe("1.0.0");
			// With bumpVersion true, nextVersion is computed using semver.inc.
			expect(result.repository.change.nextVersion).toBe("1.1.0");
			expect(result.repository.change.changelog).toBe("## RootProject: v1.1.0\n\nChangelog");
			// Only the non-root project appears in the changes list.
			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].name).toBe("OtherProject");
			expect(result.changes[0].version).toBe("2.0.0");
			expect(result.changes[0].nextVersion).toBe("2.1.0");
			expect(result.changes[0].changelog).toBe("## OtherProject: v2.1.0\n\nChangelog");
			// The overall changelog is built from the changes.
			expect(result.changelog).toContain("# Changes");
		}
	});

	it("returns change details when changes are found with bumpVersion false", async () => {
		(getRepoPath as any).mockResolvedValue(rootPath);
		const rootProject = {
			name: "RootProject",
			path: `${rootPath}/RootProject.csproj`,
			version: "1.0.0"
		};
		const otherProject = {
			name: "OtherProject",
			path: `${rootPath}/sub/OtherProject.csproj`,
			version: "2.0.0"
		};
		(getProjects as any).mockResolvedValue([rootProject, otherProject]);
		(getLatestRelease as any).mockResolvedValue("v0.9.0");

		const fakeCommit = {
			date: "2023-01-01T00:00:00",
			message: "feat: something",
			sha: "abc",
			author: "Tester"
		};
		(getCommits as any).mockResolvedValue([fakeCommit]);

		(parseConventionalCommit as any).mockReturnValue({});
		(getVersionType as any).mockReturnValue("minor");
		(getVersionTypeNumber as any).mockReturnValue(1);
		(getVersionTypeFromNumber as any).mockReturnValue("minor");
		(formatLocalChangelogAsMarkdown as any).mockReturnValue("Changelog");

		const result = await getChangeDetails(false);
		expect(result).toBeDefined();
		if (result) {
			// When bumpVersion is false, nextVersion remains the original version.
			expect(result.repository.change.nextVersion).toBe("1.0.0");
			expect(result.repository.change.changelog).toBe("## RootProject: v1.0.0\n\nChangelog");
			expect(result.changes[0].nextVersion).toBe("2.0.0");
			expect(result.changes[0].changelog).toBe("## OtherProject: v2.0.0\n\nChangelog");
		}
	});
});
