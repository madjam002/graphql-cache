import {visit} from 'graphql/language/visitor'

const VISIT_SKIP_THIS_NODE = false
const VISIT_REMOVE_NODE = null

export function passThroughQuery(cache, query) {
  return visitTree(query, [cache])
}

function visitTree(ast, cacheStack) {
  return visit(ast, {

    enter(node, key, parent, path, ancestors) {
      if (node.kind === 'Field') {
        const cacheStackTop = getTopOfStack(cacheStack)

        if (cacheStackTop == null) {
          // console.log()
          return
        }

        const cacheKey = getCacheKey(node)
        const selectionSet = node.selectionSet

        if (selectionSet) {
          if (Array.isArray(cacheStackTop[cacheKey])) {
            // pushToStack(cacheStack, cacheStackTop[cacheKey])
            //
            // console.log('Visiting array', cacheKey)
            // const res = visitArray(selectionSet, cacheStack)
            //
            // popTopFromStack(cacheStack)
            //
            // return res
          } else {
            pushToStack(cacheStack, cacheStackTop[cacheKey])
          }
        } else {
          if (cacheStackTop[cacheKey]) {
            return VISIT_REMOVE_NODE
          }
        }
      }
    },

    leave(node) {
      if (node.kind === 'Field') {
        const selectionSet = node.selectionSet

        if (selectionSet) {
          popTopFromStack(cacheStack)
        }
      }

      // remove empty fragments
      if (node.selectionSet && node.selectionSet.selections.length === 0) {
        return VISIT_REMOVE_NODE
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

function visitArray(ast, cacheStack) {
  const cacheStackTop = getTopOfStack(cacheStack)

  cacheStackTop.forEach((element, index) => {
    cacheStackTop[index] = {}

    pushToStack(cacheStack, cacheStackTop[index])
    visitTree(ast, cacheStack, getNewStackFrom(element))
    popTopFromStack(cacheStack)
  })
}
