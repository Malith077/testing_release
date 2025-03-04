// ghCommands.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// IMPORTANT: Mock child_process before importing any modules that use it.
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

// Also mock commitAndPushChanges from "./git"
vi.mock("./git", () => ({
  commitAndPushChanges: vi.fn(() => Promise.resolve()),
}));

// Now import the (mocked) execFile and functions under test.
import { execFile } from "child_process";
import semver from "semver";
import {
  getExistingReleasePullRequest,
  getRepoName,
  getLatestRelease,
  createOrUpdatePullRequest,
  promoteRelease,
  createOrUpdateRelease,
  dispatchWorkflow,
  checkRCStatus,
} from "./github"; // adjust the path if needed

// Reset mocks before each test.
beforeEach(() => {
  vi.resetAllMocks();
});

describe("getExistingReleasePullRequest", () => {
  it("should resolve with PR number when matching headRef is found", async () => {
    const headRef = "release-branch";
    const prs = [{ number: 42, headRefName: headRef }];
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(null, JSON.stringify(prs), "");
    });
    const prNumber = await getExistingReleasePullRequest(headRef);
    expect(prNumber).toBe(42);
  });

  it("should resolve with undefined when no matching headRef is found", async () => {
    const headRef = "release-branch";
    const prs = [{ number: 42, headRefName: "other-branch" }];
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(null, JSON.stringify(prs), "");
    });
    const prNumber = await getExistingReleasePullRequest(headRef);
    expect(prNumber).toBeUndefined();
  });

  it("should reject if execFile errors", async () => {
    const headRef = "release-branch";
    const errorMessage = "error occurred";
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(new Error("error"), "", errorMessage);
    });
    await expect(getExistingReleasePullRequest(headRef)).rejects.toThrow(
      errorMessage
    );
  });
});

//////////////////////////
// getRepoName
//////////////////////////
describe("getRepoName", () => {
  it("should resolve with repo name from JSON", async () => {
    const repoName = "owner/repo";
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(null, JSON.stringify({ nameWithOwner: repoName }), "");
    });
    const result = await getRepoName();
    expect(result).toBe(repoName);
  });

  it("should reject if execFile errors", async () => {
    const errorMessage = "error fetching repo";
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(new Error("error"), "", errorMessage);
    });
    await expect(getRepoName()).rejects.toThrow(errorMessage);
  });
});

//////////////////////////
// getLatestRelease
//////////////////////////
describe("getLatestRelease", () => {
  it("should resolve with the latest non-draft release tag", async () => {
    const repoName = "owner/repo";
    // First call: getRepoName
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        callback(null, JSON.stringify({ nameWithOwner: repoName }), "");
      })
      // Second call: API call to get releases.
      .mockImplementationOnce((cmd, args, callback) => {
        const releases = [
          { tag_name: "v1.0.0", draft: false },
          { tag_name: "v1.1.0", draft: false },
          { tag_name: "v1.2.0", draft: true },
        ];
        callback(null, JSON.stringify(releases), "");
      });
    const latest = await getLatestRelease();
    // Since releases are reverse-sorted, v1.1.0 is expected.
    expect(latest).toBe("v1.1.0");
  });

  it("should reject if execFile errors on API call", async () => {
    const repoName = "owner/repo";
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        callback(null, JSON.stringify({ nameWithOwner: repoName }), "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        callback(new Error("error"), "", "api error");
      });
    await expect(getLatestRelease()).rejects.toThrow("api error");
  });
});

//////////////////////////
// createOrUpdatePullRequest
//////////////////////////
describe("createOrUpdatePullRequest", () => {
  const headRef = "release-branch";
  const title = "Release Title";
  const body = "Release Body";

  it("should update pull request when one exists", async () => {
    // For getExistingReleasePullRequest, return a PR number.
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        // First call: getExistingReleasePullRequest call.
        const prs = [{ number: 101, headRefName: headRef }];
        callback(null, JSON.stringify(prs), "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // Second call: createOrUpdateLabel call.
        callback(null, "", "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // Third call: updatePullRequest call.
        callback(null, "", "");
      });
    await createOrUpdatePullRequest(headRef, title, body);
    // Verify that the updatePullRequest branch was triggered (update call contains "pr", "edit" and "101")
    const calls = (execFile as any).mock.calls;
    const updateCall = calls[2];
    expect(updateCall[0]).toBe("gh");
    expect(updateCall[1]).toContain("pr");
    expect(updateCall[1]).toContain("edit");
    expect(updateCall[1]).toContain("101");
  });

  it("should create pull request when none exists", async () => {
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        // First call: getExistingReleasePullRequest returns empty array.
        callback(null, JSON.stringify([]), "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // Second call: createOrUpdateLabel call.
        callback(null, "", "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // Third call: createPullRequest call.
        callback(null, "", "");
      });
    await createOrUpdatePullRequest(headRef, title, body);
    const calls = (execFile as any).mock.calls;
    const createCall = calls[2];
    expect(createCall[0]).toBe("gh");
    expect(createCall[1]).toContain("pr");
    expect(createCall[1]).toContain("create");
    expect(createCall[1]).toContain(headRef);
  });
});

//////////////////////////
// promoteRelease
//////////////////////////
describe("promoteRelease", () => {
  it("should resolve when promotion succeeds", async () => {
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(null, "", "");
    });
    await expect(promoteRelease("1.2.3")).resolves.toBeUndefined();
    expect(execFile).toHaveBeenCalledWith(
      "gh",
      ["release", "edit", "v1.2.3", "--draft=false"],
      expect.any(Function)
    );
  });

  it("should reject when promotion fails", async () => {
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(new Error("fail"), "", "");
    });
    await expect(promoteRelease("1.2.3")).rejects.toThrow("fail");
  });
});

//////////////////////////
// createOrUpdateRelease
//////////////////////////
describe("createOrUpdateRelease", () => {
  const version = "1.2.3";
  const changelog = "Changelog content";

  it("should create release when it does not exist", async () => {
    // Simulate releaseExists: first call (release view) fails.
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        // release view call fails -> release does not exist.
        callback(new Error("not found"), "", "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // createRelease call.
        callback(null, "", "");
      });
    await expect(createOrUpdateRelease(version, changelog, true)).resolves.toBeUndefined();
    expect(execFile).toHaveBeenCalledWith(
      "gh",
      [
        "release",
        "create",
        "v1.2.3",
        "--title",
        "v1.2.3",
        "--notes",
        changelog,
        "--draft=true",
      ],
      expect.any(Function)
    );
  });

  it("should update release when it exists", async () => {
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        // release view call succeeds -> release exists.
        callback(null, "", "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // updateRelease call.
        callback(null, "", "");
      });
    await expect(createOrUpdateRelease(version, changelog, false)).resolves.toBeUndefined();
    expect(execFile).toHaveBeenCalledWith(
      "gh",
      [
        "release",
        "edit",
        "v1.2.3",
        "--title",
        "v1.2.3",
        "--notes",
        changelog,
        "--draft=false",
      ],
      expect.any(Function)
    );
  });
});

//////////////////////////
// dispatchWorkflow
//////////////////////////
describe("dispatchWorkflow", () => {
  it("should resolve when workflow dispatch succeeds", async () => {
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(null, "", "");
    });
    await expect(dispatchWorkflow("test-workflow")).resolves.toBeUndefined();
    expect(execFile).toHaveBeenCalledWith(
      "gh",
      ["workflow", "run", "test-workflow"],
      expect.any(Function)
    );
  });

  it("should reject when workflow dispatch fails", async () => {
    (execFile as any).mockImplementation((cmd, args, callback) => {
      callback(new Error("failed"), "", "");
    });
    await expect(dispatchWorkflow("test-workflow")).rejects.toThrow("failed");
  });
});

//////////////////////////
// checkRCStatus
//////////////////////////
describe("checkRCStatus", () => {
  let originalExit: typeof process.exit;
  let exitSpy: any;
  beforeEach(() => {
    originalExit = process.exit;
    exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number): never => {
      throw new Error(`process.exit: ${code}`);
    });
  });
  afterEach(() => {
    exitSpy.mockRestore();
  });

  it("should resolve and not exit when no blocking RC PRs are found", async () => {
    // First call: simulate release list returning a release tag.
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        callback(null, "v1.2.3", "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // Second call: simulate pr list call returning no matching PRs.
        callback(null, JSON.stringify([]), "");
      });
    await expect(checkRCStatus()).resolves.toBeUndefined();
  });

  it("should call process.exit when blocking RC PRs are found", async () => {
    (execFile as any)
      .mockImplementationOnce((cmd, args, callback) => {
        // Simulate release list call returning tag v1.2.3.
        callback(null, "v1.2.3", "");
      })
      .mockImplementationOnce((cmd, args, callback) => {
        // Simulate pr list call returning a PR whose headRefName matches versioning/release/1.2.3.
        const prs = [{ headRefName: "versioning/release/1.2.3" }];
        callback(null, JSON.stringify(prs), "");
      });
    await expect(checkRCStatus()).rejects.toThrow("process.exit: 1");
  });

  it("should call process.exit when an error occurs", async () => {
    (execFile as any).mockImplementationOnce((cmd, args, callback) => {
      // Simulate error in release list call.
      callback(new Error("fail"), "", "release list error");
    });
    await expect(checkRCStatus()).rejects.toThrow("process.exit: 1");
  });
});
