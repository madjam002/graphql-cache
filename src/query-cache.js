import {visit} from 'graphql/language/visitor'
import {simplifyAst} from './util/ast'

const VISIT_SKIP_THIS_NODE = false

export function queryCache(cache, query, queryVariables = null) {
  const simplifiedAst = simplifyAst(query, queryVariables)
  const result = {}

  visitTree(simplifiedAst, getNewStackFrom(cache), getNewStackFrom(result))

  return result
}

function visitTree(ast, cacheStack, resultStack) {
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

            visitArray(selectionSet, cacheStack, resultStack)

            popTopFromStack(cacheStack)
            popTopFromStack(resultStack)

            return VISIT_SKIP_THIS_NODE
          } else {
            if (!resultStackTop[resultKey]) {
              resultStackTop[resultKey] = {}
            }

            pushToStack(cacheStack, cacheStackTop[cacheKey])
            pushToStack(resultStack, resultStackTop[resultKey])
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
          popTopFromStack(cacheStack)
          popTopFromStack(resultStack)
        }
      }
    },

  })
}

function getNewStackFrom(obj) {
  return [obj]
}

function getTopOfStack(stack) {
  return stack[stack.length - 1]
}

function pushToStack(stack, obj) {
  return stack.push(obj)
}

function popTopFromStack(stack) {
  return stack.pop()
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

function visitArray(ast, cacheStack, resultStack) {
  const cacheStackTop = getTopOfStack(cacheStack)
  const resultStackTop = getTopOfStack(resultStack)

  cacheStackTop.forEach((element, index) => {
    resultStackTop[index] = {}

    pushToStack(cacheStackTop, cacheStackTop[index])
    pushToStack(resultStackTop, resultStackTop[index])

    visitTree(ast, cacheStackTop, resultStackTop)

    popTopFromStack(cacheStackTop)
    popTopFromStack(resultStackTop)
  })
}
