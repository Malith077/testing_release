import { glob } from "glob";
import path from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { createAndPushTags, getRepoPath } from "./git";
import { getProjects } from './dotnet'

(async () => {
	const projectPath =
		"/Users/prabuddhamalith.gangodagamage/work/rp_bug/reverse-proxy-poc";
	// const csprojFiles = await new Promise<string[]>((resolve, reject) => {
	// 	glob("**/*.csproj", { cwd: projectPath }, (err, matches) => {
	// 		if (err) {
	// 			reject(err);
	// 		} else {
	// 			resolve(matches);
	// 		}
	// 	});
	// });
	// const csprojFiles = await new Promise<string[]>(() => {
	// 	glob("**/*.csproj", { cwd: projectPath });
	// });

	const rootPath = await getRepoPath();

	const projects = await getProjects(rootPath);
	console.log("projects: ", projects);



})();
