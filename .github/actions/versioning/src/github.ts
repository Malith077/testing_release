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
				// Continue without failing.
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

/**
 * Checks for blocking release-candidate PRs.
 * A blocking RC PR is one whose branch version is less than or equal to the latest official release.
 * Exits with error if blocking PRs exist.
 */
export async function checkRCStatus(): Promise<void> {
	try {
		// Get the latest official release tag, e.g., "v5.0.4".
		const latestReleaseTag = await execCommand("gh", [
			"release",
			"view",
			"--latest",
			"--json",
			"tagName",
			"--jq",
			".tagName",
		]);
		// Remove leading "v" if present.
		const latestReleaseVersion = latestReleaseTag.startsWith("v")
			? latestReleaseTag.slice(1)
			: latestReleaseTag;
		console.log(`Latest official release: ${latestReleaseTag} (${latestReleaseVersion})`);

		// List all open PRs with the "release-candidate" label.
		const prJson = await execCommand("gh", [
			"pr",
			"list",
			"--state",
			"open",
			"--label",
			"release-candidate",
			"--json",
			"headRefName",
		]);
		const prs = JSON.parse(prJson) as Array<{ headRefName: string }>;

		// Filter PRs that are for a version less than or equal to the latest official release.
		const blockingPRs = prs.filter(pr => {
			const match = pr.headRefName.match(/versioning\/release\/(\d+\.\d+\.\d+)/);
			if (match) {
				const branchVersion = match[1];
				// If the branch version is less than or equal to the latest official version, it's blocking.
				return semver.lte(branchVersion, latestReleaseVersion);
			}
			return false;
		});

		if (blockingPRs.length > 0) {
			console.error(
				`Blocking RC PR(s) found for current release: ${blockingPRs
					.map(pr => pr.headRefName)
					.join(", ")}`
			);
			process.exit(1);
		} else {
			console.log("No blocking RC PRs found. Proceeding with release creation.");
		}
	} catch (error) {
		console.error("Error checking RC status:", error);
		process.exit(1);
	}
}

// Helper: execute a command and return stdout as a trimmed string.
function execCommand(cmd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, (err, stdout, stderr) => {
			if (err) {
				reject(stderr || err.message);
			} else {
				resolve(stdout.trim());
			}
		});
	});
}

// If this module is executed directly, check RC status.
if (require.main === module) {
	checkRCStatus();
}
