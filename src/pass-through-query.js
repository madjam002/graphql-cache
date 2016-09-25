import {visit} from 'graphql/language/visitor'

const VISIT_REMOVE_NODE = null

export function passThroughQuery(cache, query, variables) {
  const astPendingDeletion = visitTree(query, query, [cache], variables)
  const newAst = visitTreeDeleteUnusedFragments(visitTreeDeleteNodes(astPendingDeletion))

  if (!newAst || (newAst.definitions.length === 0)) {
    return null
  }

  return newAst
}

function visitTree(rootAst, ast, cacheStack, variables, insideQuery = false) {
  let skipAfter = null

  return visit(ast, {

    enter(node, key, parent, path) {
      if (skipAfter) return false

      if (node.kind === 'OperationDefinition' && node.operation === 'query') {
        insideQuery = true
        return
      }

      if (!insideQuery) {
        return
      }

      if (node.kind === 'FragmentSpread') {
        const nameOfFragment = node.name.value
        const fragment = getFragment(rootAst, nameOfFragment)

        const newFragment = {
          ...fragment,
          selectionSet: visitTree(rootAst, fragment.selectionSet, cacheStack, variables, true),
        }

        replaceFragment(rootAst, nameOfFragment, newFragment)

        return false
      }

      if (node.kind === 'Field') {
        const cacheStackTop = getTopOfStack(cacheStack)

        if (cacheStackTop == null) {
          return
        }

        const cacheKey = getCacheKey(node, variables)
        const selectionSet = node.selectionSet
        const cachedValue = cacheStackTop[cacheKey]

        if (selectionSet) {
          if (cachedValue === null || (Array.isArray(cachedValue) && cachedValue.length === 0)) {
            pushToStack(cacheStack, cachedValue)
            return markAsShouldDelete(node)
          } else if (Array.isArray(cachedValue)) {
            pushToStack(cacheStack, cachedValue)

            const res = visitArray(rootAst, node.selectionSet, cacheStack, variables)

            const newNode = {
              ...node,
              selectionSet: res,
            }

            skipAfter = newNode

            return newNode
          } else {
            pushToStack(cacheStack, cachedValue)
          }
        } else {
          if (cachedValue !== undefined) {
            return markAsShouldDelete(node)
          } else {
            return markAsKeep(node)
          }
        }
      }
    },

    leave(node) {
      if (skipAfter === node) skipAfter = null

      if (node.kind === 'OperationDefinition' && node.operation === 'query') {
        insideQuery = false
        return
      }

      if (!insideQuery) {
        return
      }

      if (node.kind === 'Field') {
        const selectionSet = node.selectionSet

        if (selectionSet) {
          popTopFromStack(cacheStack)
        }
      }
    },

  })
}

function visitTreeDeleteNodes(ast) {
  return visit(ast, {
    enter(node) {
      if (node.__shouldDelete && node.kind === 'Field') {
        return VISIT_REMOVE_NODE
      }
    },
    leave(node) {
      // remove empty fragments
      if (node.selectionSet && node.selectionSet.selections.length === 0) {
        return VISIT_REMOVE_NODE
      }

      if (node.kind === 'InlineFragment' && node.selectionSet === null) {
        return VISIT_REMOVE_NODE
      }
    },
  })
}

function visitTreeDeleteUnusedFragments(ast) {
  const usedFragments = []

  const newAst = visit(ast, {
    enter(node) {
      // remove fragmentspread's referencing non-existant fragments
      if (node.kind === 'FragmentSpread') {
        const nameOfFragment = node.name.value
        const fragment = getFragment(ast, nameOfFragment)

        if (!fragment) {
          return VISIT_REMOVE_NODE
        }

        usedFragments.push(nameOfFragment)
      }
    },
  })

  return visit(newAst, {
    enter(node) {
      if (node.kind === 'FragmentDefinition') {
        const nameOfFragment = node.name.value

        if (!usedFragments.includes(nameOfFragment)) {
          return VISIT_REMOVE_NODE
        }
      }
    },
  })
}

function markAsShouldDelete(node) {
  if (node.__shouldDelete !== undefined) return

  return {
    ...node,
    __shouldDelete: true,
  }
}

function markAsKeep(node) {
  return {
    ...node,
    __shouldDelete: false,
  }
}

function getFragment(ast, name) {
  if (ast.kind !== 'Document') {
    throw new Error('getFragment(): ast.kind is not Document')
  }

  const { definitions } = ast

  return definitions.find(def => def.name && def.name.value === name)
}

function replaceFragment(ast, name, newFragment) {
  if (ast.kind !== 'Document') {
    throw new Error('replaceFragment(): ast.kind is not Document')
  }

  const { definitions } = ast

  const found = definitions.find(def => def.name && def.name.value === name)

  Object.assign(found, newFragment)
  return
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

function getCacheKey(node, variables) {
  const baseName = node.name.value

  if (node.arguments.length === 0) {
    return baseName
  }

  const args = {}

  node.arguments.forEach(argument => {
    if (argument.value.kind === 'Variable') {
      const variableName = argument.value.name.value

      if (variables[variableName] == null) {
        throw new Error(`getCacheKey(): Variable referenced "${variableName}" but not provided`)
      }

      return args[argument.name.value] = variables[variableName].toString()
    } else {
      args[argument.name.value] = argument.value.value
    }
  })

  return baseName + '|' + JSON.stringify(args)
}

function visitArray(rootAst, ast, cacheStack, variables) {
  const cacheStackTop = getTopOfStack(cacheStack)

  let lastAst = ast

  cacheStackTop.forEach(element => {
    pushToStack(cacheStack, element)
    lastAst = visitTree(rootAst, lastAst, cacheStack, variables, true)
    popTopFromStack(cacheStack)
  })

  return lastAst
}
