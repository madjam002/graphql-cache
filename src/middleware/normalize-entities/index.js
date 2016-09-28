import {cacheKey, ensureSelectionSetHasField, fieldsInSelectionSet} from '../../util'

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
      }
    },

    leaveSelectionSet(node, cacheStack, resultStack) {
      const result = getTopOfStack(resultStack)

      if (result.id) {
        cacheStack.pop()
      }
    },
  },

  passThroughQuery: {
    enterSelectionSet(node, cacheStack) {
      const result = getTopOfStack(cacheStack)

      if (result.id) {
        // got entity
        const cache = cacheStack[0]
        const nodeCacheKey = cacheKey('node', { id: result.id })

        if (!cache[nodeCacheKey]) {
          cache[nodeCacheKey] = {}
        }

        const nodeInCache = cache[nodeCacheKey]

        cacheStack.push(nodeInCache)
      }
    },
    leaveSelectionSet(node, cacheStack) {
      const result = getTopOfStack(cacheStack)

      if (result.id) {
        cacheStack.pop()

        const fields = fieldsInSelectionSet(node)

        // if there fields which need to be queried, make sure we are querying for the id
        // so it can be put into the cache later on
        if (fields.length > 0) {
          return ensureSelectionSetHasField(node, 'id')
        }
      }
    },
  },
}

function getTopOfStack(stack) {
  return stack[stack.length - 1]
}
