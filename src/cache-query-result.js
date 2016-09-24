import {visit} from 'graphql/language/visitor'

const VISIT_SKIP_THIS_NODE = false

export function cacheQueryResult(previousCache, query, result) {
  const cache = {...previousCache}

  visitTree(query, getNewStackFrom(cache), getNewStackFrom(result))

  return cache
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

        if (selectionSet) {
          if (resultStackTop[resultKey] == null) {
            cacheStackTop[cacheKey] = resultStackTop[resultKey]

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

            visitArray(selectionSet, cacheStack, resultStack)

            popTopFromStack(cacheStack)
            popTopFromStack(resultStack)

            return VISIT_SKIP_THIS_NODE
          } else {
            if (!cacheStackTop[cacheKey]) {
              cacheStackTop[cacheKey] = {}
            }

            pushToStack(cacheStack, cacheStackTop[cacheKey])
            pushToStack(resultStack, resultStackTop[resultKey])
          }
        } else {
          cacheStackTop[cacheKey] = resultStackTop[resultKey]
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
    // if (argument.value.kind === 'Variable') {
    //   args[argument.name.value] = variables[argument.value.name.value]
    // } else {
    args[argument.name.value] = argument.value.value
    // }
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

  resultStackTop.forEach((element, index) => {
    cacheStackTop[index] = {}

    pushToStack(cacheStack, cacheStackTop[index])
    visitTree(ast, cacheStack, getNewStackFrom(element))
    popTopFromStack(cacheStack)
  })
}
