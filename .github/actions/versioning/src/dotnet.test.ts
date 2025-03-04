// dotnet.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

// --- MOCK DEPENDENCIES ---

// Mock fs/promises methods.
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock fs methods.
vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

// Mock the projects configuration with a default export.
vi.mock("../projects/projects.json", () => ({
  default: { projects: ["TestProject"] },
}));

// Now import the functions under test.
import { getProjects, updateProjectVersion, DotnetProject } from "./dotnet";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getProjects", () => {
  it("should return a DotnetProject when the project file exists and has AssemblyName and Version", async () => {
    const rootPath = "/fake/root";
    // Expected project file path for project "TestProject".
    const projectPath = path.join(rootPath, "TestProject", "TestProject.csproj");

    // Simulate that the project file exists.
    (existsSync as unknown as jest.Mock).mockReturnValue(true);

    // Simulate a csproj file with both <AssemblyName> and <Version> tags.
    const csprojContent = `<Project>
  <PropertyGroup>
    <AssemblyName>MyTestProject</AssemblyName>
    <Version>2.3.4</Version>
  </PropertyGroup>
</Project>`;
    (readFile as any).mockResolvedValue(csprojContent);

    const projects = await getProjects(rootPath);
    expect(projects).toEqual([
      { name: "MyTestProject", version: "2.3.4", path: projectPath },
    ]);
  });

  it("should return an empty array if the project file does not exist", async () => {
    const rootPath = "/fake/root";
    // Simulate that the file does not exist.
    (existsSync as unknown as jest.Mock).mockReturnValue(false);

    const projects = await getProjects(rootPath);
    expect(projects).toEqual([]);
  });

  it("should skip a project if reading its file fails", async () => {
    const rootPath = "/fake/root";
    // Simulate that the file exists.
    (existsSync as unknown as jest.Mock).mockReturnValue(true);
    // Simulate a read error.
    (readFile as any).mockRejectedValue(new Error("read error"));

    const projects = await getProjects(rootPath);
    expect(projects).toEqual([]);
  });
});

describe("updateProjectVersion", () => {
  it("should update the version when a <Version> tag exists", async () => {
    const projectPath = "/fake/path/TestProject.csproj";
    const originalContent = `<Project>
  <PropertyGroup>
    <Version>1.0.0</Version>
  </PropertyGroup>
</Project>`;
    const newVersion = "2.0.0";
    const versionSuffix = "beta";

    (readFile as any).mockResolvedValue(originalContent);

    await updateProjectVersion(projectPath, newVersion, versionSuffix);

    // The <Version> tag should be replaced with the new version and suffix.
    const expectedContent = `<Project>
  <PropertyGroup>
    <Version>2.0.0-beta</Version>
  </PropertyGroup>
</Project>`;
    expect(writeFile).toHaveBeenCalledWith(projectPath, expectedContent);
  });

  it("should insert a <Version> tag if one does not exist", async () => {
    const projectPath = "/fake/path/TestProject.csproj";
    const originalContent = `<Project>
  <PropertyGroup>
    <SomeOtherTag>value</SomeOtherTag>
  </PropertyGroup>
</Project>`;
    const newVersion = "2.0.0";
    const versionSuffix = ""; // No suffix

    (readFile as any).mockResolvedValue(originalContent);

    await updateProjectVersion(projectPath, newVersion, versionSuffix);

    // Check that the written content contains the inserted <Version> tag.
    const writtenContent = (writeFile as any).mock.calls[0][1] as string;
    expect(writtenContent).toContain(`<Version>2.0.0</Version>`);
    expect(writtenContent).toMatch(/<PropertyGroup>\s*\n\s*<Version>2\.0\.0<\/Version>/i);
  });
});
