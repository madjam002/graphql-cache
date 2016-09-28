import {
  getTopOfStack,
  markAsKeep,
} from '../../util'

const STORAGE_KEY = '$$sessionMeta'

export const sessionValidation = (opts = { sessionId: null }) => ({
  cacheQueryResult: {
    leaveSelectionSet(node, cacheStack, resultStack) {
      const data = getTopOfStack(resultStack)
      const dataInCache = getTopOfStack(cacheStack)

      const meta = {
        ...dataInCache[STORAGE_KEY],
      }

      for (const k in data) {
        if (k === STORAGE_KEY) continue
        meta[k] = opts.sessionId
      }

      dataInCache[STORAGE_KEY] = meta
    },
  },
  passThroughQuery: {
    enterField(node, cacheStack, cacheKey) {
      const data = getTopOfStack(cacheStack)
      const meta = data[STORAGE_KEY]

      if (!meta || !meta[cacheKey] || (meta[cacheKey] != null && meta[cacheKey] !== opts.sessionId)) {
        // refetch as it's from another session or there's no session associated with it
        return markAsKeep(node)
      }
    },
  },
})
