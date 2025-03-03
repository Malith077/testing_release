export function sortComparer<T, S extends string | number | boolean | Date>(
	getter: (obj: T) => S,
	direction: 'asc' | 'desc' = 'asc',
): (a: T, b: T) => number {
	const directionMultiplier = direction === 'asc' ? 1 : -1;
	return (objA: T, objB: T) => {
		const valA = getter(objA);
		const valB = getter(objB);

		if (valA < valB) {
			return -1 * directionMultiplier;
		}
		if (valA > valB) {
			return 1 * directionMultiplier;
		}
		return 0;
	};
}

export function createMap<T, K, V = T>(
	array: T[],
	keyFn: (item: T) => K,
	valueFn: (item: T) => V = item => item as unknown as V,
): Map<K, V> {
	const map = new Map<K, V>();

	for (const item of array) {
		const key = keyFn(item);
		const value = map.get(key);

		if (!value) {
			map.set(key, valueFn(item));
		}
	}

	return map;
}

export function maxReducer<T, S extends string | number | boolean | Date>(getter: (obj: T) => S) {
	return (max: S, item: T) => {
		const value = getter(item);
		if (value > max) {
			return value;
		}
		return max;
	};
}

export function groupBy<T, K, V = T>(
	array: T[],
	keyFn: (item: T) => K,
	valueFn: (item: T) => V = item => item as unknown as V,
): Map<K, V[]> {
	const map = new Map<K, V[]>();

	for (const item of array) {
		const key = keyFn(item);
		let items = map.get(key);

		if (!items) {
			items = [];
			map.set(key, items);
		}

		items.push(valueFn(item));
	}

	return map;
}

export function mapToObject<K extends string, V>(map: Map<K, V>): Record<K, V> {
	return Object.fromEntries(map.entries()) as Record<K, V>;
}
