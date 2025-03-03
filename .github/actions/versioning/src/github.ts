import { execFile } from "child_process";
import semver from "semver";
import { commitAndPushChanges } from "./git";

type Release = {
	tag_name: string;
	draft: boolean;
};

export function getExistingReleasePullRequest(headRef: string) {
	return new Promise<number | undefined>((resolve, reject) => {
		const args = [
			"pr",
			"list",
			"--head",
			headRef,
			"--json",
			"number,headRefName",
		];
		execFile("gh", args, (err, stdout, stderr) => {
			if (err) {
				reject(new Error(stderr || err.message));
			} else {
				const prs: Array<{ number: number; headRefName: string }> =
					JSON.parse(stdout);
				resolve(prs.find((pr) => pr.headRefName === headRef)?.number);
			}
		});
	});
}

export function getRepoName() {
	return new Promise<string>((resolve, reject) => {
		const args = ["repo", "view", "--json", "nameWithOwner"];
		execFile("gh", args, (err, stdout, stderr) => {
			if (err) {
				reject(new Error(stderr || err.message));
			} else {
				const { nameWithOwner } = JSON.parse(stdout);
				resolve(nameWithOwner as string);
			}
		});
	});
}

export async function getLatestRelease() {
	const repoFullName = await getRepoName();
	return new Promise<string | undefined>((resolve, reject) => {
		const args = ["api", `/repos/${repoFullName}/releases`];
		execFile("gh", args, (err, stdout, stderr) => {
			if (err) {
				reject(new Error(stderr || err.message));
			} else {
				const releases = (JSON.parse(stdout) as Release[])
					.filter((release) => !release.draft)
					.sort((a, b) => {
						const va = semver.coerce(a.tag_name)!;
						const vb = semver.coerce(b.tag_name)!;

						// reverse sort
						return semver.compare(vb, va);
					});

				resolve(releases[0]?.tag_name);
			}
		});
	});
}

function createPullRequest(headRef: string, title: string, body: string) {
	return new Promise<void>((resolve, reject) => {
		const args = [
			"pr",
			"create",
			"--head",
			headRef,
			"--title",
			title,
			"--body",
			body,
			"--label",
			"release-candidate",
		];
		execFile("gh", args, (err, stdout, stderr) => {
			if (err) {
				reject(new Error(stderr || err.message));
			} else {
				resolve();
			}
		});
	});
}

function updatePullRequest(number: number, title: string, body: string) {
	return new Promise<void>((resolve, reject) => {
		const args = [
			"pr",
			"edit",
			number.toString(),
			"--title",
			title,
			"--body",
			body,
			"--add-label",
			"release-candidate",
		];
		execFile("gh", args, (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});
}

function createOrUpdateLabel(name: string, color: string, description: string) {
	return new Promise<void>((resolve, reject) => {
		const args = [
			"label",
			"create",
			name,
			"--color",
			color,
			"--description",
			description,
			"--force",
		];
		execFile("gh", args, (err, stdout, stderr) => {
			if (err) {
				reject(new Error(stderr || err.message));
			} else {
				resolve();
			}
		});
	});
}

export async function createOrUpdatePullRequest(
	headRef: string,
	title: string,
	body: string
) {
	await commitAndPushChanges(headRef, title);

	const prNumber = await getExistingReleasePullRequest(headRef);

	await createOrUpdateLabel(
		"release-candidate",
		"cccccc",
		"Release candidate pull requests"
	);

	if (prNumber) {
		return await updatePullRequest(prNumber, title, body);
	}

	return await createPullRequest(headRef, title, body);
}

async function createRelease(version: string, changelog: string, draft = true) {
	const releaseName = `v${version}`;
	return new Promise<void>((resolve, reject) => {
		const args = [
			"release",
			"create",
			releaseName,
			"--title",
			releaseName,
			"--notes",
			changelog,
			`--draft=${draft}`,
		];
		execFile("gh", args, (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});
}

async function updateRelease(version: string, changelog: string, draft = true) {
	const releaseName = `v${version}`;
	console.log(`Updating release ${releaseName}`);
	return new Promise<void>((resolve, reject) => {
		const args = [
			"release",
			"edit",
			releaseName,
			"--title",
			releaseName,
			"--notes",
			changelog,
			`--draft=${draft}`,
		];
		execFile("gh", args, (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});
}

export async function promoteRelease(version: string) {
	const releaseName = `v${version}`;
	return new Promise<void>((resolve, reject) => {
		const args = ["release", "edit", releaseName, "--draft=false"];
		execFile("gh", args, (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});
}

async function releaseExists(version: string) {
	const releaseName = `v${version}`;
	return new Promise<boolean>((resolve, reject) => {
		const args = ["release", "view", releaseName, "--json", "name"];
		execFile("gh", args, (err) => {
			if (err) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
}

export async function createOrUpdateRelease(
	version: string,
	changelog: string,
	draft = true
) {
	const exists = await releaseExists(version);
	if (!exists) {
		return createRelease(version, changelog, draft);
	}

	return updateRelease(version, changelog, draft);
}

export function dispatchWorkflow(workflowName: string) {
	return new Promise<void>((resolve, reject) => {
		const args = ["workflow", "run", workflowName];
		execFile("gh", args, (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});
}


import { execFile } from "child_process";

export async function closeExistingReleaseCandidatePR(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // List open PRs with the "release-candidate" label.
    execFile(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "open",
        "--label",
        "release-candidate",
        "--json",
        "number",
        "--jq",
        ".[0].number"
      ],
      (err, stdout, stderr) => {
        if (err) {
          console.error("Error listing RC PRs:", stderr);
          // If there's an error (or no PR found), simply resolve.
          return resolve();
        }
        const prNumber = stdout.trim();
        if (prNumber) {
          console.log("Closing existing release candidate PR:", prNumber);
          execFile(
            "gh",
            [
              "pr",
              "close",
              prNumber,
              "--delete-branch",
              "-c",
              "Closing outdated RC due to major version update"
            ],
            (err2, stdout2, stderr2) => {
              if (err2) {
                console.error("Error closing RC PR:", stderr2);
                return reject(err2);
              }
              resolve();
            }
          );
        } else {
          // No RC PR found.
          resolve();
        }
      }
    );
  });
}
