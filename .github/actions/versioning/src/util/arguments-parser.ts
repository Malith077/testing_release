import { parseArgs } from 'node:util';

const options = {
	'suffix': {
		type: 'string' as const,
	},
	'build-number': {
		type: 'string' as const,
	},
};

export function getVersionSuffix(): string | undefined {
	const { values } = parseArgs({ options });
	return values.suffix;
}

export function getBuildNumber(): string | undefined {
	const { values } = parseArgs({ options });
	return values['build-number'];
}

