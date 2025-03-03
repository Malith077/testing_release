import { glob } from "glob";
import path from "path";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { createAndPushTags, getRepoPath } from "./git";

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
	const csprojFiles = await glob("**/*.csproj", { cwd: projectPath });
	console.log("csprojFiles: ", csprojFiles);
	const rootPath = await getRepoPath();

	const csprojPath = path.join(
		rootPath,
		"Releasing_app",
		"Releasing_app.csproj"
	);
	console.log("csprojPath: ", csprojPath);
	if (!existsSync(csprojPath)) {
		console.log(`No csproj file found at ${csprojPath}`);
		return;
	}

	const csprojContent = await readFile(csprojPath, "utf-8");
	const versionMatch = csprojContent.match(/<Version>(.*?)<\/Version>/);
	console.log("versionMatch: ", versionMatch);
	if (!versionMatch) {
		console.log(`No <Version> tag found in ${csprojPath}`);
		return;
	}
	const version = versionMatch[1].trim();

})();
