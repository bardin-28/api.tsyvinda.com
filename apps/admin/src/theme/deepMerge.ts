type PlainObject = Record<string, unknown>;

/**
 * `@mui/utils` is only a transitive dependency, so its `deepmerge` is not
 * importable under pnpm's strict layout. Mirrors its semantics: recurse into
 * plain objects, replace everything else (arrays and React elements included).
 */
const isPlainObject = (value: unknown): value is PlainObject => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
};

export const deepMerge = <T>(target: T, source: unknown): T => {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return (source === undefined ? target : source) as T;
  }

  const result: PlainObject = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    result[key] =
      isPlainObject(targetValue) && isPlainObject(sourceValue)
        ? deepMerge(targetValue, sourceValue)
        : sourceValue;
  }

  return result as T;
};
