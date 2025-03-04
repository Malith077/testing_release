// workspaces.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

// --- MOCK DEPENDENCIES ---

// Mock the "glob" module.
vi.mock("glob", () => ({
  glob: vi.fn(),
}));

// Mock the "fs" module (for existsSync and readFile).
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFile: vi.fn(),
}));

// Mock the changelog module.
vi.mock("./changelog", () => ({
  createOrUpdateChangelogFile: vi.fn(),
}));

// Mock the dotnet module.
vi.mock("./dotnet", () => ({
  updateProjectVersion: vi.fn(),
}));

// Import the functions under test.
import {
  updateAllProjects,
  getProjectVersion,
  getWorkspaceVersion,
  updateAllWorkspaces,
} from "./workspace"; // adjust path as needed

// Import the mocked functions for later inspection.
import { glob } from "glob";
import { readFile, existsSync } from "fs";
import { createOrUpdateChangelogFile } from "./changelog";
import { updateProjectVersion } from "./dotnet";

// Create some fake change details to use in tests.
const fakeChangeDetails = {
  rootPath: "/repo",
  repository: {
    change: {
      name: "RootProject",
      location: "RootProject",
      version: "1.0.0",
      nextVersion: "1.1.0",
      commits: [],
      versionType: "minor",
      changelog: "Root changelog",
    },
  },
  changes: [
    {
      name: "ProjectA",
      location: "ProjectA",
      version: "1.0.0",
      nextVersion: "1.1.0",
      commits: [],
      versionType: "minor",
      changelog: "ProjectA changelog",
    },
  ],
  changelog: "# Changes\n\n...",
};

beforeEach(() => {
  vi.resetAllMocks();
});

//////////////////////////
// getProjectVersion & getWorkspaceVersion
//////////////////////////
describe("getProjectVersion", () => {
  it("should return project version info when a csproj file is found", async () => {
    const rootPath = "/repo";
    const projectLocation = "ProjectX";
    const projectDir = path.join(rootPath, projectLocation);

    // Simulate glob (promise version) returning one csproj file.
    (glob as any).mockResolvedValue(["TestProject.csproj"]);

    // Simulate fs.readFile (callback version) returning a csproj file content.
    (readFile as any).mockImplementation(
      (filePath: string, encoding: string, callback: (err: Error | null, data?: string) => void) => {
        const content = `<Project>
  <PropertyGroup>
    <AssemblyName>MyProject</AssemblyName>
    <Version>2.0.0</Version>
  </PropertyGroup>
</Project>`;
        callback(null, content);
      }
    );

    const result = await getProjectVersion(rootPath, projectLocation);
    expect(result).toEqual({
      name: "MyProject",
      location: projectLocation,
      version: "2.0.0",
    });
  });

  it("should return undefined if no csproj files are found", async () => {
    const rootPath = "/repo";
    const projectLocation = "ProjectX";
    (glob as any).mockResolvedValue([]);
    const result = await getProjectVersion(rootPath, projectLocation);
    expect(result).toBeUndefined();
  });
});

describe("getWorkspaceVersion", () => {
  it("should return the same value as getProjectVersion", async () => {
    const rootPath = "/repo";
    const projectLocation = "ProjectX";
    (glob as any).mockResolvedValue(["TestProject.csproj"]);
    (readFile as any).mockImplementation(
      (filePath: string, encoding: string, callback: (err: Error | null, data?: string) => void) => {
        const content = `<Project>
  <PropertyGroup>
    <AssemblyName>MyProject</AssemblyName>
    <Version>2.0.0</Version>
  </PropertyGroup>
</Project>`;
        callback(null, content);
      }
    );
    const result = await getWorkspaceVersion(rootPath, projectLocation);
    expect(result).toEqual({
      name: "MyProject",
      location: projectLocation,
      version: "2.0.0",
    });
  });
});

//////////////////////////
// updateAllProjects & updateAllWorkspaces
//////////////////////////
describe("updateAllProjects", () => {
  it("should determine the base version and update each project", async () => {
    // For determineBaseVersion:
    // When glob is called with a csproj search in any project folder, return one dummy csproj.
    (glob as any).mockResolvedValue(["dummy.csproj"]);
    // When reading the csproj file for base version, simulate file content that includes a <Version> tag.
    (readFile as any).mockImplementation(
      (filePath: string, encoding: string, callback: (err: Error | null, data?: string) => void) => {
        callback(null, `<Project>
  <PropertyGroup>
    <Version>3.0.0</Version>
  </PropertyGroup>
</Project>`);
      }
    );
    // For each applyProjectVersionChanges call, the function calls:
    // - createOrUpdateChangelogFile if changelog exists.
    // - updateProjectVersion if a csproj file is found.
    const changelogSpy = createOrUpdateChangelogFile as unknown as ReturnType<typeof vi.fn>;
    const updateVersionSpy = updateProjectVersion as unknown as ReturnType<typeof vi.fn>;

    await updateAllProjects(fakeChangeDetails, "rc1");

    // Expect two updates (one for repository.change and one for each change in changes array).
    expect(updateVersionSpy).toHaveBeenCalledTimes(2);
    // And expect that the changelog function was called for both projects.
    expect(changelogSpy).toHaveBeenCalledTimes(2);
  });
});

describe("updateAllWorkspaces", () => {
  it("should update all workspaces similar to updateAllProjects", async () => {
    (glob as any).mockResolvedValue(["dummy.csproj"]);
    (readFile as any).mockImplementation(
      (filePath: string, encoding: string, callback: (err: Error | null, data?: string) => void) => {
        callback(null, `<Project>
  <PropertyGroup>
    <Version>3.0.0</Version>
  </PropertyGroup>
</Project>`);
      }
    );
    const changelogSpy = createOrUpdateChangelogFile as unknown as ReturnType<typeof vi.fn>;
    const updateVersionSpy = updateProjectVersion as unknown as ReturnType<typeof vi.fn>;

    await updateAllWorkspaces(fakeChangeDetails, "rc1");

    expect(updateVersionSpy).toHaveBeenCalledTimes(2);
    expect(changelogSpy).toHaveBeenCalledTimes(2);
  });
});
