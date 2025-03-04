// src/git.test.ts

import { vi, describe, it, expect, afterEach } from "vitest";

// MOCK: Ensure the child_process module is mocked before importing your module.
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

// Now import the mocked execFile and the functions from your module.
import { execFile } from "child_process";
import {
  getCommits,
  getRepoPath,
  commitAndPushChanges,
  createAndPushTags,
} from "./git";

// Reset the mock implementation after each test.
afterEach(() => {
  execFile.mockReset();
});

describe("getCommits", () => {
  it("should return parsed commits", async () => {
    const fakeOutput =
      "abc123\x00John Doe <john@example.com>\x002023-03-01T12:00:00\x00Initial commit\x00%%\n";
    execFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, fakeOutput, "");
      }
    );
    const commits = await getCommits("some/path", "ref1", "ref2");
    expect(commits).toEqual([
      {
        sha: "abc123",
        author: "John Doe <john@example.com>",
        date: "2023-03-01T12:00:00",
        message: "Initial commit",
      },
    ]);
  });

  it("should reject promise if execFile errors", async () => {
    const errorMsg = "log error occurred";
    execFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(new Error("error"), "", errorMsg);
      }
    );
    await expect(getCommits("some/path", "ref1", "ref2")).rejects.toThrow(
      errorMsg
    );
  });
});

describe("getRepoPath", () => {
  it("should return the trimmed repository path", async () => {
    execFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, "/path/to/repo\n", "");
      }
    );
    const repoPath = await getRepoPath();
    expect(repoPath).toBe("/path/to/repo");
  });

  it("should reject promise if execFile errors", async () => {
    const errorMsg = "rev-parse error";
    execFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(new Error("error"), "", errorMsg);
      }
    );
    await expect(getRepoPath()).rejects.toThrow(errorMsg);
  });
});

describe("commitAndPushChanges", () => {
  it("should create branch, add, commit, and push changes", async () => {
    execFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, "", "");
      }
    );
    const branchName = "test-branch";
    const message = "Test commit message";
    const upstream = "origin";
    await commitAndPushChanges(branchName, message, upstream);
    // Verify that the commands were called in order.
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      "git",
      ["checkout", "-B", branchName],
      expect.any(Function)
    );
    expect(execFile).toHaveBeenNthCalledWith(
      2,
      "git",
      ["add", "-A"],
      expect.any(Function)
    );
    expect(execFile).toHaveBeenNthCalledWith(
      3,
      "git",
      ["commit", "-am", message],
      expect.any(Function)
    );
    expect(execFile).toHaveBeenNthCalledWith(
      4,
      "git",
      ["push", upstream, branchName, "-f"],
      expect.any(Function)
    );
  });

  it("should reject if branch creation fails", async () => {
    const errorMsg = "branch creation error";
    execFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        if (args[0] === "checkout") {
          callback(new Error(errorMsg), "", errorMsg);
        } else {
          callback(null, "", "");
        }
      }
    );
    await expect(
      commitAndPushChanges("branch", "message", "origin")
    ).rejects.toThrow(errorMsg);
  });
});

describe("createAndPushTags", () => {
  it("should create and push tags", async () => {
    const tags = ["v1.0.0", "v1.0.1"];
    const upstream = "origin";
    execFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(null, "", "");
      }
    );
    await createAndPushTags(tags, upstream);
    // Two calls for tag creation and two for pushing tags.
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      "git",
      ["tag", "v1.0.0", "--force"],
      expect.any(Function)
    );
    expect(execFile).toHaveBeenNthCalledWith(
      2,
      "git",
      ["tag", "v1.0.1", "--force"],
      expect.any(Function)
    );
    expect(execFile).toHaveBeenNthCalledWith(
      3,
      "git",
      ["push", upstream, "refs/tags/v1.0.0", "--force"],
      expect.any(Function)
    );
    expect(execFile).toHaveBeenNthCalledWith(
      4,
      "git",
      ["push", upstream, "refs/tags/v1.0.1", "--force"],
      expect.any(Function)
    );
  });

  it("should reject if tag creation fails", async () => {
    const errorMsg = "tag creation failed";
    execFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        callback: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        if (args[0] === "tag") {
          callback(new Error(errorMsg), "", errorMsg);
        } else {
          callback(null, "", "");
        }
      }
    );
    await expect(createAndPushTags(["v1.0.0"], "origin")).rejects.toThrow(
      errorMsg
    );
  });
});
