 import { setOutput } from '@actions/core';
import { getChangeDetails } from './changes';
import { getWorkspaceVersion, updateAllProjects } from './workspace';
import { getRepoPath } from './git';
import { getBuildNumber, getVersionSuffix } from './util/arguments-parser';
import projectDefinitions from '../projects/projects.json';

(async () => {
	const changeDetails = await getChangeDetails(true);
	if (!changeDetails) {
		return;
	}

	const versionSuffix = getVersionSuffix() ?? '';
	const buildNumber = getBuildNumber();

	await updateAllProjects(changeDetails, versionSuffix, buildNumber);

	const rootPath = await getRepoPath();

	// Helper: For a given project, retrieve version details from changes.
	const getProjectVersions = async (project: string) =>
		await Promise.all(
			changeDetails.changes
				.filter(change => change.location.startsWith(project) && change.versionType !== 'none')
				.map(async change => getWorkspaceVersion(rootPath, change.location))
				.filter(Boolean),
		);

	const projectMatrix = await Promise.all(
		projectDefinitions.projects.map(async project => {
			const versions = await getProjectVersions(project);
			let versionData: { name: string; location: string; version: string } | undefined;

			if (versions.length > 0) {
				versionData = versions[0];
			} else {
				versionData = await getWorkspaceVersion(rootPath, project);
			}

			return versionData;
		}),
	).then(results => results.filter(Boolean));

	projectMatrix.forEach(project => {
		if (project) {
			setOutput(`${project.name}-version`.toLowerCase(), project.version);
		}
	});
})();