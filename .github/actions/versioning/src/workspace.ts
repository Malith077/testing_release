import path from "path";
import { glob, Glob } from "glob";
import { existsSync, readFile } from "fs";
import { createOrUpdateChangelogFile } from "./changelog";
import { DotnetProject, updateProjectVersion } from "./dotnet";
import { ChangeDetails, ProjectChangeInformation } from "./changes";

export async function updateAllProjects(
	changeDetails: ChangeDetails,
	versionSuffix: string = ""
): Promise<void> {
	await applyProjectVersionChanges(
		changeDetails.rootPath,
		changeDetails.repository.change,
		versionSuffix
	);
}

async function applyProjectVersionChanges(
	rootPath: string,
	change: ProjectChangeInformation,
	versionSuffix: string
): Promise<void> {
	const projectPath = path.join(rootPath, change.location);

	if (change.changelog) {
		await createOrUpdateChangelogFile(projectPath, change.changelog);
	}

	if (change.versionType !== "none" && change.nextVersion) {
		const csprojFiles = await glob("**/*.csproj", { cwd: projectPath });

		if (csprojFiles.length > 0) {
			const csprojPath = path.join(projectPath, csprojFiles[0]);
			await updateProjectVersion(
				csprojPath,
				change.nextVersion,
				versionSuffix
			);
		}
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
	// Update the repository (root) change first
	await applyProjectVersionChanges(
		changeDetails.rootPath,
		changeDetails.repository.change,
		versionSuffix
	);

	// Then update every other project that has changes
	for (const change of changeDetails.changes) {
		await applyProjectVersionChanges(
			changeDetails.rootPath,
			change,
			versionSuffix
		);
	}
}
