// src/git.test.ts

import { describe, it, expect, vi, afterEach } from "vitest";
import { execFile } from "child_process";
import {
  getCommits,
  getRepoPath,
  commitAndPushChanges,
  createAndPushTags,
} from "./git"; // Adjust the import path to your file

// Reset mocks after each test.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCommits", () => {
  it("should return parsed commits", async () => {
    // Simulate a git log output for one commit.
    const fakeOutput =
      "abc123\x00John Doe <john@example.com>\x002023-03-01T12:00:00\x00Initial commit\x00%%\n";
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        callback(null, fakeOutput, "");
      });

    const commits = await getCommits("some/path", "ref1", "ref2");
    expect(commits).toEqual([
      {
        sha: "abc123",
        author: "John Doe <john@example.com>",
        date: "2023-03-01T12:00:00",
        message: "Initial commit",
      },
    ]);
    execFileMock.mockRestore();
  });

  it("should reject promise if execFile errors", async () => {
    const errorMsg = "log error occurred";
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        callback(new Error("error"), "", errorMsg);
      });

    await expect(getCommits("some/path", "ref1", "ref2")).rejects.toThrow(
      errorMsg
    );
    execFileMock.mockRestore();
  });
});

describe("getRepoPath", () => {
  it("should return the trimmed repository path", async () => {
    const fakePath = "/path/to/repo\n";
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        callback(null, fakePath, "");
      });

    const repoPath = await getRepoPath();
    expect(repoPath).toBe("/path/to/repo");
    execFileMock.mockRestore();
  });

  it("should reject promise if execFile errors", async () => {
    const errorMsg = "rev-parse error";
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        callback(new Error("error"), "", errorMsg);
      });

    await expect(getRepoPath()).rejects.toThrow(errorMsg);
    execFileMock.mockRestore();
  });
});

describe("commitAndPushChanges", () => {
  it("should create branch, add, commit, and push changes", async () => {
    // For commitAndPushChanges, there are 4 git commands executed sequentially.
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        // Always succeed by calling callback with no error.
        callback(null, "", "");
      });

    const branchName = "test-branch";
    const message = "Test commit message";
    const upstream = "origin";

    await commitAndPushChanges(branchName, message, upstream);

    // Verify the sequence of execFile calls.
    // 1. Checkout with force: git checkout -B test-branch
    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      "git",
      ["checkout", "-B", branchName],
      expect.any(Function)
    );
    // 2. Add all changes: git add -A
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      "git",
      ["add", "-A"],
      expect.any(Function)
    );
    // 3. Commit changes: git commit -am message
    expect(execFileMock).toHaveBeenNthCalledWith(
      3,
      "git",
      ["commit", "-am", message],
      expect.any(Function)
    );
    // 4. Push to upstream: git push origin test-branch -f
    expect(execFileMock).toHaveBeenNthCalledWith(
      4,
      "git",
      ["push", upstream, branchName, "-f"],
      expect.any(Function)
    );

    execFileMock.mockRestore();
  });

  it("should reject if branch creation fails", async () => {
    const errorMsg = "branch creation error";
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        // Fail the first call (branch creation)
        if (cmd === "git" && args[0] === "checkout") {
          callback(new Error("error"), "", errorMsg);
        } else {
          callback(null, "", "");
        }
      });

    await expect(
      commitAndPushChanges("branch", "message", "origin")
    ).rejects.toThrow(errorMsg);
    execFileMock.mockRestore();
  });
});

describe("createAndPushTags", () => {
  it("should create and push tags", async () => {
    // For two tags, we expect 4 execFile calls:
    // Two for creating tags and two for pushing tags.
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        callback(null, "", "");
      });

    const tags = ["v1.0.0", "v1.0.1"];
    const upstream = "origin";

    await createAndPushTags(tags, upstream);

    // Verify tag creation calls.
    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      "git",
      ["tag", "v1.0.0", "--force"],
      expect.any(Function)
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      2,
      "git",
      ["tag", "v1.0.1", "--force"],
      expect.any(Function)
    );
    // Verify tag push calls.
    expect(execFileMock).toHaveBeenNthCalledWith(
      3,
      "git",
      ["push", upstream, "refs/tags/v1.0.0", "--force"],
      expect.any(Function)
    );
    expect(execFileMock).toHaveBeenNthCalledWith(
      4,
      "git",
      ["push", upstream, "refs/tags/v1.0.1", "--force"],
      expect.any(Function)
    );

    execFileMock.mockRestore();
  });

  it("should reject if tag creation fails", async () => {
    const errorMsg = "tag creation failed";
    const execFileMock = vi
      .spyOn(require("child_process"), "execFile")
      .mockImplementation((cmd, args, callback) => {
        // Fail on tag creation commands.
        if (args[0] === "tag") {
          callback(new Error("error"), "", errorMsg);
        } else {
          callback(null, "", "");
        }
      });

    await expect(createAndPushTags(["v1.0.0"], "origin")).rejects.toThrow(
      errorMsg
    );
    execFileMock.mockRestore();
  });
});
