 import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { parseStringPromise, Builder, ParserOptions } from 'xml2js';
import projectsConfig from '../projects/projects.json';

export type DotnetProject = {
	name: string;
	version: string;
	path: string;
};

type CsProjXML = {
	Project: {
		PropertyGroup: {
			AssemblyName?: string;
			Version?: string;
			AssemblyVersion?: string;
			[key: string]: string | undefined;
		};
		[key: string]: unknown;
	};
};

export async function getProjects(rootPath: string): Promise<DotnetProject[]> {
	const projectsList: string[] = (projectsConfig && projectsConfig.projects) || ['ReverseProxy'];

	const projectPromises = projectsList.map(async projectName => {
		const projectPath = path.join(rootPath, projectName, `${projectName}.csproj`);
		if (!existsSync(projectPath)) {
			console.warn(`Project file for ${projectName} not found at ${projectPath}`);
			return undefined;
		}

		try {
			const content = await readFile(projectPath, 'utf-8');
			const parsedXml = (await parseStringPromise(content, {
				explicitArray: false,
			} as ParserOptions)) as CsProjXML;

			const propertyGroup = parsedXml.Project.PropertyGroup;
			const name = propertyGroup.AssemblyName || projectName;
			const version = propertyGroup.Version || '1.0.0';

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
	versionSuffix?: string,
	buildNumber?: string,
): Promise<void> {
	const originalContent = await readFile(projectPath, 'utf-8');

	const parsedXml = (await parseStringPromise(originalContent, {
		preserveChildrenOrder: true,
		explicitArray: false,
		explicitCharkey: true,
	} as ParserOptions)) as CsProjXML;

	if (!parsedXml.Project) {
		throw new Error('Invalid csproj format: Missing Project element.');
	}

	if (!parsedXml.Project.PropertyGroup) {
		parsedXml.Project.PropertyGroup = {};
	}

	parsedXml.Project.PropertyGroup.Version = versionSuffix ? `${newVersion}-${versionSuffix}` : newVersion;

	parsedXml.Project.PropertyGroup.AssemblyVersion = `${newVersion}.${buildNumber || 0}`;

	const builder = new Builder({
		renderOpts: { pretty: true, indent: '  ', newline: '\n' },
		headless: true,
	});

	const updatedXml = builder.buildObject(parsedXml);
	await writeFile(projectPath, updatedXml, 'utf-8');
}

export async function getProjectInfo(projectPath: string): Promise<DotnetProject | undefined> {
	if (!existsSync(projectPath)) {
		console.warn(`Project file not found at ${projectPath}`);
		return undefined;
	}

	try {
		const content = await readFile(projectPath, 'utf-8');
		const parsedXml = (await parseStringPromise(content, {
			explicitArray: false,
		} as ParserOptions)) as CsProjXML;

		const propertyGroup = parsedXml.Project.PropertyGroup;
		return {
			name: propertyGroup.AssemblyName || path.basename(projectPath, '.csproj'),
			version: propertyGroup.Version || '1.0.0',
			path: projectPath,
		};
	} catch (e: unknown) {
		console.error(`Error reading project file ${projectPath}:`, e);
		return undefined;
	}
}
