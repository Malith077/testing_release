import { exportVariable } from "@actions/core";
import { getChangeDetails } from "./changes";
import { getWorkspaceVersion, updateAllWorkspaces } from "./workspace";
import { getRepoPath } from "./git";
import projectDefinitions from "../projects/projects.json";
const VERSION_SUFFIX_EXPRESSION = /^--suffix=(?<suffix>[^\s]+)$/;

function getVersionSuffix(): string | undefined {
	const arg = process.argv
		.slice(2)
		.find((arg) => VERSION_SUFFIX_EXPRESSION.test(arg));
	return arg?.match(VERSION_SUFFIX_EXPRESSION)?.groups?.suffix;
}

(async () => {
	const changeDetails = await getChangeDetails(true);
	if (!changeDetails) {
		console.log("No changes detected.");
		return;
	}

	const versionSuffix = getVersionSuffix() ?? "";
	await updateAllWorkspaces(changeDetails, versionSuffix);

	const rootPath = await getRepoPath();

	// Process each project from the config
	for (const project of projectDefinitions.projects) {
		const projectChange = changeDetails.changes.find(
			(change) =>
				change.location.startsWith(project) &&
				change.versionType !== "none"
		);

		const projectVersion = projectChange
			? await getWorkspaceVersion(rootPath, projectChange.location)
			: await getWorkspaceVersion(rootPath, project);

		if (projectVersion) {
			exportVariable(project, JSON.stringify(projectVersion));
			console.log(
				`Exported ${project} version: ${JSON.stringify(projectVersion)}`
			);
		} else {
			console.log(`${project} version not found.`);
		}
	}
})();
