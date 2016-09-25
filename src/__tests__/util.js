export function cacheKey(field, args) {
  if (!args) {
    return field
  }

  const stringifiableArgs = {}

  for (const k in args) {
    stringifiableArgs[k] = args[k].toString()
  }

  return `${field}|${JSON.stringify(stringifiableArgs)}`
}
