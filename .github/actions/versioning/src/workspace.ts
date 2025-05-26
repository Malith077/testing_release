import path from 'path';
import { glob } from 'glob';
import { createOrUpdateChangelogFile } from './changelog';
import { updateProjectVersion, getProjectInfo } from './dotnet';
import { ChangeDetails, ProjectChangeInformation } from './changes';

export async function updateAllProjects(
	changeDetails: ChangeDetails,
	versionSuffix: string = '',
	buildNumber: string = '',
): Promise<void> {
	for (const change of changeDetails.changes) {
		await applyProjectVersionChanges(changeDetails.rootPath, change, versionSuffix, buildNumber);
	}
}

async function applyProjectVersionChanges(
	rootPath: string,
	change: ProjectChangeInformation,
	versionSuffix: string,
	buildNumber: string,
): Promise<void> {
	const projectPath = path.join(rootPath, change.location);

	if (change.changelog) {
		await createOrUpdateChangelogFile(projectPath, change.changelog);
	}

	if (change.versionType !== 'none' && change.nextVersion) {
		const csprojFiles = await glob('**/*.csproj', { cwd: projectPath });

		if (csprojFiles.length > 0) {
			const csprojPath = path.join(projectPath, csprojFiles[0]);
			await updateProjectVersion(csprojPath, change.nextVersion, versionSuffix, buildNumber);
		}
	}
}

export async function getProjectVersion(
	rootPath: string,
	projectLocation: string,
): Promise<{ name: string; location: string; version: string } | undefined> {
	const projectDir = path.join(rootPath, projectLocation);
	const csprojFiles = await glob('**/*.csproj', { cwd: projectDir });

	if (csprojFiles.length === 0) {
		console.log(`No csproj files found in ${projectDir}`);
		return undefined;
	}

	const fullPath = path.join(projectDir, csprojFiles[0]);
	const project = await getProjectInfo(fullPath);

	return project
		? {
				name: project.name,
				location: projectLocation,
				version: project.version,
			}
		: undefined;
}

/**
 * Returns the version information for a given workspace (project) location.
 * This is essentially a wrapper around getProjectVersion.
 */
export async function getWorkspaceVersion(
	rootPath: string,
	projectLocation: string,
): Promise<{ name: string; location: string; version: string } | undefined> {
	return getProjectVersion(rootPath, projectLocation);
}
