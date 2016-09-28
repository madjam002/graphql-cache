import {
  cacheKey,
  getTopOfStack,
  popTopFromStack,
  pushToStack,
  ensureSelectionSetHasField,
  fieldsInSelectionSet,
} from '../../util'

function isEntity(maybeEntity) {
  return maybeEntity && maybeEntity.id
}

function pushNodeToTopOfStack(cacheStack, node) {
  const rootCache = cacheStack[0]
  const nodeCacheKey = cacheKey('node', { id: node.id })

  if (!rootCache[nodeCacheKey]) {
    rootCache[nodeCacheKey] = {}
  }

  const nodeInCache = rootCache[nodeCacheKey]

  pushToStack(cacheStack, nodeInCache)
}

export const normalizeEntities = {
  cacheQueryResult: {
    enterSelectionSet(node, cacheStack, resultStack) {
      const result = getTopOfStack(resultStack)

      if (isEntity(result)) {
        // got entity

        // set id on original tree in cache so it points to node
        getTopOfStack(cacheStack).id = result.id

        pushNodeToTopOfStack(cacheStack, result)
      }
    },

    leaveSelectionSet(node, cacheStack, resultStack) {
      const result = getTopOfStack(resultStack)

      if (isEntity(result)) {
        popTopFromStack(cacheStack)
      }
    },
  },

  passThroughQuery: {
    enterSelectionSet(node, cacheStack) {
      const result = getTopOfStack(cacheStack)

      if (isEntity(result)) {
        // got entity
        pushNodeToTopOfStack(cacheStack, result)
      }
    },
    leaveSelectionSet(node, cacheStack) {
      const result = getTopOfStack(cacheStack)

      if (isEntity(result)) {
        popTopFromStack(cacheStack)

        const fields = fieldsInSelectionSet(node)

        // if there fields which need to be queried, make sure we are querying for the id
        // so it can be put into the cache later on
        if (fields.length > 0) {
          return ensureSelectionSetHasField(node, 'id')
        }
      }
    },
  },

  queryCache: {
    enterSelectionSet(node, cacheStack) {
      const result = getTopOfStack(cacheStack)

      if (isEntity(result)) {
        // got entity
        pushNodeToTopOfStack(cacheStack, result)
      }
    },

    leaveSelectionSet(node, cacheStack) {
      const result = getTopOfStack(cacheStack)

      if (isEntity(result)) {
        popTopFromStack(cacheStack)
      }
    },
  },
}
