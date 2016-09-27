import {cacheKey} from '../../util'

export const normalizeEntities = {
  cacheQueryResult: {
    enterSelectionSet(node, cacheStack, resultStack) {
      const result = getTopOfStack(resultStack)

      if (result.id) {
        // got entity

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

    leaveSelectionSet(node, cacheStack, resultStack) {
      const result = getTopOfStack(resultStack)

      if (result.id) {
        cacheStack.pop()
        return true
      }
    },
  },
}

function getTopOfStack(stack) {
  return stack[stack.length - 1]
}
