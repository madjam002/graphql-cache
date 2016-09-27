export const normalizeEntities = {
  enter(node, cacheStack, resultStack) {
    const result = getTopOfStack(resultStack)

    if (result.id) {
      // got entity
      // console.log('Got entity!', node, result, getTopOfStack(cacheStack))

      // set id on original tree in cache so it points to node
      getTopOfStack(cacheStack).id = result.id

      const cache = cacheStack[0]
      const nodeCacheKey = cacheKey('node', { id: result.id })

      if (!cache[nodeCacheKey]) {
        cache[nodeCacheKey] = {}
      }

      const nodeInCache = cache[nodeCacheKey]

      cacheStack.push(nodeInCache)

      return true
    }
  },

  leave(node, cacheStack, resultStack) {
    const result = getTopOfStack(resultStack)

    if (result.id) {
      cacheStack.pop()
      return true
    }
  },
}

function getTopOfStack(stack) {
  return stack[stack.length - 1]
}

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
