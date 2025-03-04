import path from "path";
import { glob } from "glob";
import { existsSync, readFile } from "fs";
import { createOrUpdateChangelogFile } from "./changelog";
import { DotnetProject, updateProjectVersion } from "./dotnet";
import { ChangeDetails, ProjectChangeInformation } from "./changes";

/**
 * Helper function that scans all csproj files under the provided project locations.
 * - If any csproj file contains a <Version> tag, that version is used as the base.
 * - If none are found, returns "1.0.0".
 */
async function determineBaseVersion(
	rootPath: string,
	projectLocations: string[]
): Promise<string> {
	for (const projectLocation of projectLocations) {
		const projectPath = path.join(rootPath, projectLocation);
		const csprojFiles = await glob("**/*.csproj", { cwd: projectPath });
		if (csprojFiles.length > 0) {
			const csprojPath = path.join(projectPath, csprojFiles[0]);
			const content = await new Promise<string>((resolve, reject) => {
				readFile(csprojPath, "utf-8", (err, data) => {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});
			});
			const versionMatch = content.match(/<Version>(.*?)<\/Version>/i);
			if (versionMatch && versionMatch[1]) {
				return versionMatch[1];
			}
		}
	}
	return "1.0.0";
}

export async function updateAllProjects(
	changeDetails: ChangeDetails,
	versionSuffix: string = ""
): Promise<void> {
	// Gather all project locations from the repository change and projects from projects.json
	const projectLocations = [
		changeDetails.repository.change.location,
		...changeDetails.changes.map(change => change.location)
	];
	// Determine the base version from the csproj files
	const baseVersion = await determineBaseVersion(changeDetails.rootPath, projectLocations);
	console.log("Determined base version:", baseVersion);

	// Update the repository (root) change first
	await applyProjectVersionChanges(
		changeDetails.rootPath,
		changeDetails.repository.change,
		versionSuffix,
		baseVersion
	);

	// Then update every other project defined in projects.json
	for (const projectChange of changeDetails.changes) {
		await applyProjectVersionChanges(
			changeDetails.rootPath,
			projectChange,
			versionSuffix,
			baseVersion
		);
	}
}

async function applyProjectVersionChanges(
	rootPath: string,
	change: ProjectChangeInformation,
	versionSuffix: string,
	baseVersion: string
): Promise<void> {
	const projectPath = path.join(rootPath, change.location);

	// Update the changelog if available.
	if (change.changelog) {
		await createOrUpdateChangelogFile(projectPath, change.changelog);
	}

	// Look for csproj files in the project folder.
	const csprojFiles = await glob("**/*.csproj", { cwd: projectPath });
	console.log("csprojFiles: ", csprojFiles);
	if (csprojFiles.length > 0) {
		// Update the first csproj file found with the base version and versionSuffix.
		const csprojPath = path.join(projectPath, csprojFiles[0]);
		await updateProjectVersion(csprojPath, baseVersion, versionSuffix);
	}
}

export async function getProjectVersion(
	rootPath: string,
	projectLocation: string
): Promise<{ name: string; location: string; version: string } | undefined> {
	const projectDir: string = path.join(rootPath, projectLocation);
	const files = await glob("**/*.csproj", { cwd: projectDir });
	if (files.length === 0) {
		console.log(`No csproj files found in ${projectDir}`);
		return undefined;
	}

	const fullPath = path.join(projectDir, files[0]);
	const content = await new Promise<string>((resolve, reject) => {
		readFile(fullPath, "utf-8", (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
	const nameMatch = content.match(/<AssemblyName>(.*?)<\/AssemblyName>/);
	const versionMatch = content.match(/<Version>(.*?)<\/Version>/);
	const name = nameMatch ? nameMatch[1] : files[0].replace(".csproj", "");
	const version = versionMatch ? versionMatch[1] : "1.0.0";
	return { name, location: projectLocation, version };
}

/**
 * Returns the version information for a given workspace (project) location.
 * This is essentially a wrapper around getProjectVersion.
 */
export async function getWorkspaceVersion(
	rootPath: string,
	projectLocation: string
): Promise<{ name: string; location: string; version: string } | undefined> {
	return getProjectVersion(rootPath, projectLocation);
}

/**
 * Updates all workspaces in the repository based on the change details.
 * This function applies version bumps and updates changelog files for:
 *   - The root project change (repository-level change)
 *   - Every other project change listed in changeDetails.changes
 */
export async function updateAllWorkspaces(
	changeDetails: ChangeDetails,
	versionSuffix: string = ""
): Promise<void> {
	// Gather all project locations
	const projectLocations = [
		changeDetails.repository.change.location,
		...changeDetails.changes.map(change => change.location)
	];
	// Determine the base version from the csproj files
	const baseVersion = await determineBaseVersion(changeDetails.rootPath, projectLocations);
	console.log("Determined base version:", baseVersion);

	// Update the repository (root) change first
	await applyProjectVersionChanges(
		changeDetails.rootPath,
		changeDetails.repository.change,
		versionSuffix,
		baseVersion
	);

	// Then update every other project that has changes
	for (const change of changeDetails.changes) {
		await applyProjectVersionChanges(
			changeDetails.rootPath,
			change,
			versionSuffix,
			baseVersion
		);
	}
}
