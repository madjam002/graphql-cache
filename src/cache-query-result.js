import {visit} from 'graphql/language/visitor'
import {simplifyAst, getNewStackFrom, getTopOfStack, pushToStack, popTopFromStack, callMiddleware} from './util'

const VISIT_SKIP_THIS_NODE = false

export function cacheQueryResult(previousCache, query, result, queryVariables = null, ...middleware) {
  const cache = {...previousCache}
  const simplifiedAst = simplifyAst(query, queryVariables)

  visitTree(simplifiedAst, getNewStackFrom(cache), getNewStackFrom(result), middleware)

  return cache
}

function visitTree(ast, cacheStack, resultStack, middleware = []) {
  visit(ast, {

    enter(node, key, parent, path, ancestors) {
      if (node.kind === 'Field') {
        const cacheStackTop = getTopOfStack(cacheStack)
        const resultStackTop = getTopOfStack(resultStack)

        const cacheKey = getCacheKey(node)
        const resultKey = getResultKey(node)
        const selectionSet = node.selectionSet

        if (selectionSet) {
          if (resultStackTop[resultKey] === null) {
            cacheStackTop[cacheKey] = resultStackTop[resultKey]

            return VISIT_SKIP_THIS_NODE
          } else if (resultStackTop[resultKey] == null) {
            return VISIT_SKIP_THIS_NODE
          }

          // ensure immutability if existing data is present
          if (cacheStackTop[cacheKey] != null) {
            cacheStackTop[cacheKey] = {...cacheStackTop[cacheKey]}
          }

          if (Array.isArray(resultStackTop[resultKey])) {
            cacheStackTop[cacheKey] = [] // always wipe existing arrays in the previous cache

            pushToStack(cacheStack, cacheStackTop[cacheKey])
            pushToStack(resultStack, resultStackTop[resultKey])

            visitArray(node, cacheStack, resultStack, middleware)

            popTopFromStack(cacheStack)
            popTopFromStack(resultStack)

            return VISIT_SKIP_THIS_NODE
          } else {
            if (!cacheStackTop[cacheKey]) {
              cacheStackTop[cacheKey] = {}
            }

            pushToStack(cacheStack, cacheStackTop[cacheKey])
            pushToStack(resultStack, resultStackTop[resultKey])

            callMiddleware(middleware, 'cacheQueryResult', 'enterSelectionSet', node, cacheStack, resultStack)
          }
        } else {
          if (resultStackTop[resultKey] !== undefined) {
            cacheStackTop[cacheKey] = resultStackTop[resultKey]
          }
        }
      }
    },

    leave(node) {
      if (node.kind === 'Field') {
        const selectionSet = node.selectionSet

        if (selectionSet) {
          callMiddleware(middleware, 'cacheQueryResult', 'leaveSelectionSet', node, cacheStack, resultStack)

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

function visitArray(node, cacheStack, resultStack, middleware) {
  const ast = node.selectionSet
  const cacheStackTop = getTopOfStack(cacheStack)
  const resultStackTop = getTopOfStack(resultStack)

  resultStackTop.forEach((element, index) => {
    cacheStackTop[index] = {}

    const newResultStack = getNewStackFrom(element)

    pushToStack(cacheStack, cacheStackTop[index])
    callMiddleware(middleware, 'cacheQueryResult', 'enterSelectionSet', node, cacheStack, newResultStack)

    visitTree(ast, cacheStack, newResultStack, middleware)

    callMiddleware(middleware, 'cacheQueryResult', 'leaveSelectionSet', node, cacheStack, newResultStack)
    popTopFromStack(cacheStack)
  })
}
