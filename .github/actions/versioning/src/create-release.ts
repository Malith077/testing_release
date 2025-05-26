import { createOrUpdateRelease } from "./github";
import { createAndPushTags, getRepoPath } from "./git";
import { readFile } from "fs/promises";
import path from "path";
import { updateAllProjects } from "./workspace";
import { getChangeDetails } from "./changes";
import { setOutput } from "@actions/core";
import { existsSync } from "fs";

(async () => {
  // First, check for blocking release-candidate PRs.
  // This call will exit the process with a non-zero code if a blocking RC PR exists.

  const changeDetails = await getChangeDetails(false); // false: we are not bumping version here, just creating release.
  if (!changeDetails) {
    console.log("No changes found");
    return;
  }

  // Update all projects (for example, update version numbers and changelog files)
  await updateAllProjects(changeDetails);

  // Create a combined changelog that aggregates repository-level and project-specific changes.
  const combinedChangelog = `# Changes\n\n${changeDetails.changelog}`;

  // Use the repository change as the release version.
  const releaseVersion = changeDetails.repository.change.nextVersion;
  if (!releaseVersion) {
    console.error("No release version determined");
    return;
  }

  // Create or update the GitHub release with the combined changelog.
  // Setting draft to false so that the release is published.
  await createOrUpdateRelease(releaseVersion, combinedChangelog, false);

  // Set outputs for downstream steps (if needed)
  await setOutput("version", releaseVersion);
  await setOutput("changelog", combinedChangelog);

  console.log(`Release ${releaseVersion} created/updated successfully.`);
})();
