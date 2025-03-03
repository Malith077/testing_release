import { createOrUpdateRelease } from "./github";
import { createAndPushTags, getRepoPath } from "./git";
import { readFile } from "fs/promises";
import path from "path";
import { getChangeDetails } from "./changes";
import { setOutput } from "@actions/core";
import { existsSync } from "fs";

(async () => {
	const rootPath = await getRepoPath();

	// Locate the Releasing_app csproj file
	const csprojPath = path.join(
		rootPath,
		"Releasing_app",
		"Releasing_app.csproj"
	);
	if (!existsSync(csprojPath)) {
		console.log(`No csproj file found at ${csprojPath}`);
		return;
	}

	// Read the csproj file and extract the version from the <Version> tag
	const csprojContent = await readFile(csprojPath, "utf-8");
	const versionMatch = csprojContent.match(/<Version>(.*?)<\/Version>/);
	if (!versionMatch) {
		console.log(`No <Version> tag found in ${csprojPath}`);
		return;
	}
	const version = versionMatch[1].trim();

	// Get the change details from commit history/changelog generation
	const changeDetails = await getChangeDetails(false);
	if (!changeDetails) {
		console.log("No changes found");
		return;
	}

	// Create or update the GitHub release using the version and changelog
	await createOrUpdateRelease(version, changeDetails.changelog, false);

	// Tag the release with the version extracted from the csproj file
	await createAndPushTags([`v${version}`]);

	await setOutput("version", version);
	await setOutput("changelog", changeDetails.changelog);
})();
