import {visit} from 'graphql/language/visitor'
import {simplifyAst, getNewStackFrom, getTopOfStack, pushToStack, popTopFromStack, callMiddleware} from './util'

const VISIT_SKIP_THIS_NODE = false

export function queryCache(cache, query, queryVariables = null, ...middleware) {
  const simplifiedAst = simplifyAst(query, queryVariables)
  const result = {}

  visitTree(simplifiedAst, getNewStackFrom(cache), getNewStackFrom(result), middleware)

  return result
}

function visitTree(ast, cacheStack, resultStack, middleware) {
  visit(ast, {

    enter(node, key, parent, path, ancestors) {
      if (node.kind === 'Field') {
        const cacheStackTop = getTopOfStack(cacheStack)
        const resultStackTop = getTopOfStack(resultStack)

        const cacheKey = getCacheKey(node)
        const resultKey = getResultKey(node)
        const selectionSet = node.selectionSet

        if (cacheStackTop[cacheKey] == null) {
          resultStackTop[resultKey] = null
          return VISIT_SKIP_THIS_NODE
        }

        if (selectionSet) {
          if (Array.isArray(cacheStackTop[cacheKey])) {
            resultStackTop[resultKey] = []

            pushToStack(cacheStack, cacheStackTop[cacheKey])
            pushToStack(resultStack, resultStackTop[resultKey])

            visitArray(selectionSet, cacheStack, resultStack, middleware)

            popTopFromStack(cacheStack)
            popTopFromStack(resultStack)

            return VISIT_SKIP_THIS_NODE
          } else {
            if (!resultStackTop[resultKey]) {
              resultStackTop[resultKey] = {}
            }

            pushToStack(cacheStack, cacheStackTop[cacheKey])
            pushToStack(resultStack, resultStackTop[resultKey])

            callMiddleware(middleware, 'queryCache', 'enterSelectionSet', node, cacheStack, resultStack)
          }
        } else {
          resultStackTop[resultKey] = cacheStackTop[cacheKey]
        }
      }
    },

    leave(node) {
      if (node.kind === 'Field') {
        const selectionSet = node.selectionSet

        if (selectionSet) {
          callMiddleware(middleware, 'queryCache', 'leaveSelectionSet', node, cacheStack, resultStack)

          popTopFromStack(cacheStack)
          popTopFromStack(resultStack)
        }
      }
    },

  })
}

function getCacheKey(node) {
  const baseName = node.name.value

  if (node.arguments.length === 0) {
    return baseName
  }

  const args = {}

  node.arguments.forEach(argument => {
    args[argument.name.value] = argument.value.value
  })

  return baseName + '|' + JSON.stringify(args)
}

function getResultKey(node) {
  return node.alias
    ? node.alias.value
    : node.name.value
}

function visitArray(ast, cacheStack, resultStack, middleware) {
  const cacheStackTop = getTopOfStack(cacheStack)
  const resultStackTop = getTopOfStack(resultStack)

  cacheStackTop.forEach((element, index) => {
    resultStackTop[index] = {}

    pushToStack(cacheStack, cacheStackTop[index])
    pushToStack(resultStack, resultStackTop[index])

    visitTree(ast, cacheStack, resultStack, middleware)

    popTopFromStack(cacheStack)
    popTopFromStack(resultStack)
  })
}
