import { readFile as readFilePromise, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

import projectsConfig from "../projects/projects.json";

export type DotnetProject = {
	name: string;
	version: string;
	path: string;
};

// export async function getProject(
// 	rootPath: string
// ): Promise<DotnetProject | undefined> {
// 	const projectPath = path.join(
// 		rootPath,
// 		"Releasing_app",
// 		"Releasing_app.csproj"
// 	); // testing only - TODO: make this dynamic
// 	if (!existsSync(projectPath)) {
// 		return undefined;
// 	}
// 	try {
// 		const content = await readFile(projectPath, "utf-8");
// 		// Try to extract the AssemblyName and Version from the csproj file
// 		const nameMatch = content.match(/<AssemblyName>(.*?)<\/AssemblyName>/);
// 		const versionMatch = content.match(/<Version>(.*?)<\/Version>/);
// 		const name = nameMatch ? nameMatch[1] : "Releasing_app";
// 		const version = versionMatch ? versionMatch[1] : "1.0.0";
// 		return { name, version, path: projectPath };
// 	} catch (e) {
// 		console.error("Error reading project file", e);
// 		return undefined;
// 	}
// }

export async function getProjects(rootPath: string): Promise<DotnetProject[]> {
	// Use the imported JSON; if not available, default to single project "Releasing_app".
	const projectsList: string[] = (projectsConfig && projectsConfig.projects) || ["Releasing_app"];
	
	// For each project name, assume the csproj file is located at:
	// <root>/<projectName>/<projectName>.csproj
	const projectPromises = projectsList.map(async (projectName) => {
	  const projectPath = path.join(rootPath, projectName, `${projectName}.csproj`);
	  if (!existsSync(projectPath)) {
		console.warn(`Project file for ${projectName} not found at ${projectPath}`);
		return undefined;
	  }
	  try {
		const content = await readFilePromise(projectPath, "utf-8");
		const nameMatch = content.match(/<AssemblyName>(.*?)<\/AssemblyName>/);
		const versionMatch = content.match(/<Version>(.*?)<\/Version>/);
		const name = nameMatch ? nameMatch[1] : projectName;
		const version = versionMatch ? versionMatch[1] : "1.0.0";
		return { name, version, path: projectPath };
	  } catch (e) {
		console.error(`Error reading project file for ${projectName}:`, e);
		return undefined;
	  }
	});
	const projects = await Promise.all(projectPromises);
	return projects.filter((p): p is DotnetProject => p !== undefined);
  }

export async function updateProjectVersion(
	projectPath: string,
	newVersion: string,
	versionSuffix: string
): Promise<void> {
	const content = await readFile(projectPath, "utf-8");
	const versionRegex = /<Version>(.*?)<\/Version>/;
	let newContent: string;
	if (versionRegex.test(content)) {
		newContent = content.replace(
			versionRegex,
			`<Version>${newVersion}${
				versionSuffix ? "-" + versionSuffix : ""
			}</Version>`
		);
	} else {
		// Insert the <Version> tag into the first <PropertyGroup>
		newContent = content.replace(
			/<PropertyGroup>/,
			`<PropertyGroup>\n  <Version>${newVersion}${
				versionSuffix ? "-" + versionSuffix : ""
			}</Version>`
		);
	}

	await writeFile(projectPath, newContent);
}
