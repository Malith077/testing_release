import semver from "semver";
import {
	getVersionType,
	getVersionTypeNumber,
	getVersionTypeFromNumber,
	parseConventionalCommit,
} from "./conventional-commits";
import { getCommits, getRepoPath } from "./git";
import { getProjects, DotnetProject } from "./dotnet";
import { createMap, groupBy, maxReducer, sortComparer } from "./util/utils";
import path from "path";
import { formatLocalChangelogAsMarkdown } from "./changelog";
import { getLatestRelease } from "./github";

export type ProjectChangeInformation = {
	name: string;
	location: string;
	version: string;
	nextVersion: string | null;
	commits: Awaited<ReturnType<typeof getCommits>>;
	versionType: Awaited<ReturnType<typeof getVersionType>>;
	changelog: string | null;
};

export type ChangeDetails = {
	rootPath: string;
	repository: {
		change: ProjectChangeInformation;
	};
	changes: ProjectChangeInformation[];
	changelog: string;
};

/**
 * Helper: returns the DotnetProject whose path is closest to the repository root.
 */
function getRootProject(
	projects: DotnetProject[],
	rootPath: string
): DotnetProject | undefined {
	return projects.reduce<DotnetProject | undefined>((prev, curr) => {
		if (!prev) return curr;
		const prevDepth = path
			.relative(rootPath, prev.path)
			.split(path.sep)
			.filter(Boolean).length;
		const currDepth = path
			.relative(rootPath, curr.path)
			.split(path.sep)
			.filter(Boolean).length;
		return currDepth < prevDepth ? curr : prev;
	}, undefined);
}

async function getProjectChangeInformation(
	rootPath: string,
	project: DotnetProject,
	bumpVersion: boolean
): Promise<ProjectChangeInformation> {
	const releaseTag = await getLatestRelease();
	const commits = (
		await getCommits(
			path.dirname(project.path),
			releaseTag ? `refs/tags/${releaseTag}` : ""
		)
	).sort(sortComparer((commit) => commit.date));
	const conventionalCommits = commits.map((commit) =>
		parseConventionalCommit(commit.message)
	);

	const versionType = getVersionTypeFromNumber(
		conventionalCommits.reduce(
			maxReducer((commit) =>
				getVersionTypeNumber(getVersionType(commit))
			),
			0
		)
	);

	const nextVersion =
		versionType !== "none" && bumpVersion
			? semver.inc(project.version, versionType)
			: project.version;
	return {
		name: project.name,
		location: path.relative(rootPath, path.dirname(project.path)),
		version: project.version,
		nextVersion,
		commits,
		versionType,
		changelog:
			versionType !== "none"
				? `## ${
						project.name
				  }: v${nextVersion}\n\n${formatLocalChangelogAsMarkdown(
						conventionalCommits
				  )}`
				: null,
	};
}

export async function getChangeDetails(
	bumpVersion: boolean
): Promise<ChangeDetails | undefined> {
	const rootPath = await getRepoPath();
	const projects = await getProjects(rootPath);

	// Use the helper to determine the root project.
	const rootProject = getRootProject(projects, rootPath);
	if (!rootProject) {
		console.log("No root project found");
		return;
	}
	const rootProjectChange = await getProjectChangeInformation(
		rootPath,
		rootProject,
		bumpVersion
	);

	const otherProjects = projects.filter(
		(project) => project.path !== rootProject.path
	);

	const allChanges = await Promise.all(
		otherProjects.map((project) =>
			getProjectChangeInformation(rootPath, project, bumpVersion)
		)
	);
	let actualChanges = allChanges.filter(
		(change) => change.versionType !== "none"
	);

	if (
		rootProjectChange.versionType !== "none"
	) {
		actualChanges = [rootProjectChange, ...actualChanges];
	}

	if (actualChanges.length === 0) {
		console.log("No changes found");
		return;
	}

	const changeLog = `# Changes\n\n${actualChanges
		.map((change) => change.changelog)
		.join("\n\n")}\n`;

	return {
		rootPath,
		repository: {
			change: rootProjectChange,
		},
		changes: actualChanges,
		changelog: changeLog,
	};
}
