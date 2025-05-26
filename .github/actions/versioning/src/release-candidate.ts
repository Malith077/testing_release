import { createOrUpdatePullRequest } from './github';
import { setOutput } from '@actions/core';
import { getChangeDetails } from './changes';
import { updateAllProjects } from './workspace';

(async () => {
	const changeDetails = await getChangeDetails(true);
	if (!changeDetails) {
		return;
	}

	await updateAllProjects(changeDetails);

	await createOrUpdatePullRequest(
		`versioning/release/${changeDetails.repository.change.nextVersion}`,
		`chore: release ${changeDetails.repository.change.nextVersion}`,
		changeDetails.changelog,
	);

	if (
		changeDetails.repository.change.nextVersion &&
		changeDetails.repository.change.version !== changeDetails.repository.change.nextVersion
	) {
		setOutput('next-version', changeDetails.repository.change.nextVersion);
	}

	setOutput('changelog', changeDetails.changelog);
	setOutput(
		'updated-projects',
		changeDetails.changes.map(change => ({
			name: change.name,
			location: change.location,
			version: change.version,
		})),
	);
})();