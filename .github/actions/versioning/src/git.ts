import { execFile } from "child_process";

type Commit = {
	sha: string;
	author: string;
	date: string;
	message: string;
};

export function getCommits(
	path: string,
	fromRef: string,
	toRef: string = "HEAD"
) {
	const range = [fromRef, toRef].filter(Boolean).join("..");
	return new Promise<Commit[]>((resolve, reject) => {
		execFile(
			"git",
			[
				"log",
				range,
				"--date=iso8601",
				"--pretty=format:%H%x00%an <%ae>%x00%ad%x00%B%x00%%%%",
				"--",
				path,
			],
			(err, stdout, stderr) => {
				if (err) {
					reject(new Error(stderr || err.message));
				} else {
					const commits = stdout
						.split("%%\n")
						.filter(Boolean)
						.map((line) => {
							const [sha, author, date, message] =
								line.split("\0");
							return {
								sha,
								author,
								date,
								message: message?.trim(),
							} as Commit;
						});
					resolve(commits);
				}
			}
		);
	});
}

export function getRepoPath() {
	return new Promise<string>((resolve, reject) => {
		execFile(
			"git",
			["rev-parse", "--show-toplevel"],
			(err, stdout, stderr) => {
				if (err) {
					reject(new Error(stderr || err.message));
				} else {
					resolve(stdout.trim());
				}
			}
		);
	});
}

function createBranch(branchName: string, force: boolean = false) {
	return new Promise<void>((resolve, reject) => {
		execFile(
			"git",
			["checkout", `-${force ? "B" : "b"}`, branchName],
			(err) => {
				if (err) {
					reject(new Error(err.message));
				} else {
					resolve();
				}
			}
		);
	});
}

export async function commitAndPushChanges(
	branchName: string,
	message: string,
	upstream: string = "origin"
) {
	await createBranch(branchName, true);

	await new Promise<void>((resolve, reject) => {
		execFile("git", ["add", "-A"], (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});

	await new Promise<void>((resolve, reject) => {
		execFile("git", ["commit", "-am", message], (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});

	await new Promise<void>((resolve, reject) => {
		execFile("git", ["push", upstream, branchName, "-f"], (err) => {
			if (err) {
				reject(new Error(err.message));
			} else {
				resolve();
			}
		});
	});
}

export async function createAndPushTags(
	tagNames: string[],
	upstream: string = "origin"
) {
	for (const tagName of tagNames) {
		await new Promise<void>((resolve, reject) => {
			execFile("git", ["tag", `${tagName}`, "--force"], (err) => {
				if (err) {
					reject(new Error(err.message));
				} else {
					resolve();
				}
			});
		});
	}

	for (const tagName of tagNames) {
		await new Promise<void>((resolve, reject) => {
			execFile(
				"git",
				["push", upstream, `refs/tags/${tagName}`, "--force"],
				(err) => {
					if (err) {
						reject(new Error(err.message));
					} else {
						resolve();
					}
				}
			);
		});
	}
}
