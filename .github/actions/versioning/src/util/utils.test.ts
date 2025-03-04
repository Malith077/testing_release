import { describe, expect, it } from 'vitest';
import {
  sortComparer,
  createMap,
  maxReducer,
  groupBy,
  mapToObject,
} from './utils';

describe('utils tests', () => {
  it('sortComparer should sort in ascending order', () => {
    const arr = [{ id: 3 }, { id: 1 }, { id: 2 }];
    arr.sort(sortComparer(item => item.id));
    expect(arr).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('sortComparer should sort in descending order', () => {
    const arr = [{ id: 3 }, { id: 1 }, { id: 2 }];
    arr.sort(sortComparer(item => item.id, 'desc'));
    expect(arr).toEqual([{ id: 3 }, { id: 2 }, { id: 1 }]);
  });

  it('createMap should create a map from an array', () => {
    const arr = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'a', value: 3 },
    ];
    const map = createMap(arr, item => item.key, item => item.value);
    expect(map.size).toBe(2);
    expect(map.get('a')).toBe(1); // Should take the first occurrence
  });

  it('maxReducer should reduce to the maximum value', () => {
    const arr = [{ val: 10 }, { val: 5 }, { val: 20 }];
    const max = arr.reduce(maxReducer(item => item.val), 0);
    expect(max).toBe(20);
  });

  it('groupBy should group items by key', () => {
    const arr = [
      { group: 'a', val: 1 },
      { group: 'b', val: 2 },
      { group: 'a', val: 3 },
    ];
    const grouped = groupBy(arr, item => item.group, item => item.val);
    expect(grouped.get('a')).toEqual([1, 3]);
    expect(grouped.get('b')).toEqual([2]);
  });

  it('mapToObject should convert a Map to an object', () => {
    const map = new Map<string, number>([['a', 1], ['b', 2]]);
    const obj = mapToObject(map);
    expect(obj).toEqual({ a: 1, b: 2 });
  });
});