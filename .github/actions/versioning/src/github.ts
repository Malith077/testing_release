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
		  console.error("Warning: Could not create/update label:", stderr || err.message);
		  // Optionally, resolve instead of rejecting if you want to continue without failing.
		  return resolve();
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

export async function closeExistingReleaseCandidatePR(previousMajor: number): Promise<void> {
	return new Promise<void>((resolve, reject) => {
	  execFile(
		"gh",
		[
		  "pr",
		  "list",
		  "--state", "open",
		  "--label", "release-candidate",
		  "--json", "number,headRefName"
		],
		(err, stdout, stderr) => {
		  if (err) {
			console.error("Error listing RC PRs:", stderr);
			return resolve();
		  }
		  let prs: Array<{ number: number; headRefName: string }>;
		  try {
			prs = JSON.parse(stdout);
		  } catch (parseError) {
			console.error("Error parsing RC PR list:", parseError);
			return resolve();
		  }
		  // Filter PRs whose branch name indicates a version with the previous major.
		  const prsToClose = prs.filter(pr => {
			const match = pr.headRefName.match(/versioning\/release\/(\d+\.\d+\.\d+)/);
			if (match) {
			  const branchVersion = match[1];
			  return semver.major(branchVersion) === previousMajor;
			}
			return false;
		  });
		  if (prsToClose.length === 0) {
			console.log("No outdated RC PRs to close.");
			return resolve();
		  }
		  // Use Promise.all to attempt to close all PRs.
		  Promise.all(
			prsToClose.map(pr =>
			  new Promise<void>(resolvePr => {
				execFile(
				  "gh",
				  [
					"pr",
					"close",
					pr.number.toString(),
					"--delete-branch",
					"-c",
					"Closing outdated RC due to major version update"
				  ],
				  (err2, stdout2, stderr2) => {
					if (err2) {
					  console.error(`Error closing RC PR ${pr.number}:`, stderr2);
					} else {
					  console.log(`Closed RC PR ${pr.number} (branch ${pr.headRefName}).`);
					}
					// Resolve regardless of error to let all attempts complete.
					resolvePr();
				  }
				);
			  })
			)
		  ).then(() => resolve());
		}
	  );
	});
  }
  