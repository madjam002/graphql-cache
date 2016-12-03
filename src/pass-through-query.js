import {visit} from 'graphql/language/visitor'
import {
  getTopOfStack,
  pushToStack,
  popTopFromStack,
  callMiddleware,
  markAsKeep,
  markAsShouldDelete,
  isMarkedForDeletion,
  recursivelyMarkAsKeep,
  replaceFragment,
} from './util'

const VISIT_REMOVE_NODE = null

export function passThroughQuery(cache, query, variables = null, ...middleware) {
  // stop ast from being mutated
  const rootAst = {
    ...query,
    definitions: query.definitions.map(def => ({ ...def })),
  }

  const astPendingDeletion = visitTree(rootAst, rootAst, [cache], variables, middleware)
  let newAst = visitTreeDeleteUnusedFragments(visitTreeDeleteNodes(astPendingDeletion))
  newAst = visitTreeDeleteUnusedVariables(newAst)

  // allow for middleware to have "after" hooks to change AST
  if (middleware) {
    for (const middlewareDef of middleware) {
      if (middlewareDef.passThroughQuery && middlewareDef.passThroughQuery.after) {
        const res = middlewareDef.passThroughQuery.after(cache, newAst, variables)

        if (!res) {
          return res
        }

        newAst = res
      }
    }
  }

  if (!newAst || (newAst.definitions.length === 0)) {
    return null
  }

  return newAst
}

function visitTree(rootAst, ast, cacheStack, variables, middleware = [], insideQuery = false) {
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

      if (node.kind === 'InlineFragment') {
        const onType = node.typeCondition.name && node.typeCondition.name.value
        const cacheStackTop = getTopOfStack(cacheStack)

        // try and select fragment based on type (if __typename is present)
        if (onType && cacheStackTop && cacheStackTop.__typename) {
          if (onType !== cacheStackTop.__typename) {
            // if types don't match, skip
            return false
          }
        }
      }

      if (node.kind === 'FragmentSpread') {
        const nameOfFragment = node.name.value
        const fragment = getFragment(rootAst, nameOfFragment)
        const onType = fragment.typeCondition.name && fragment.typeCondition.name.value
        const cacheStackTop = getTopOfStack(cacheStack)

        // try and select fragment based on type (if __typename is present)
        if (onType && cacheStackTop && cacheStackTop.__typename) {
          if (onType !== cacheStackTop.__typename) {
            // if types don't match, skip
            return false
          }
        }

        const newFragment = {
          ...fragment,
          selectionSet: visitTree(rootAst, fragment.selectionSet, cacheStack, variables, middleware, true),
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
          if (cachedValue === null) {
            const nullMiddlewareResult = callMiddleware(middleware, 'passThroughQuery', 'enterNull', node, cacheStack, cacheKey)

            if (nullMiddlewareResult !== undefined) {
              if (selectionSet) {
                pushToStack(cacheStack, cachedValue)
              }

              return nullMiddlewareResult
            }
          }

          if (cachedValue === null || (Array.isArray(cachedValue) && cachedValue.length === 0)) {
            pushToStack(cacheStack, cachedValue)
            return markAsShouldDelete(node)
          } else if (cachedValue === undefined) {
            return false
          } else if (Array.isArray(cachedValue)) {
            pushToStack(cacheStack, cachedValue)

            const newNode = visitArray(rootAst, node, cacheStack, cacheKey, variables, middleware)

            skipAfter = newNode

            return newNode
          } else {
            pushToStack(cacheStack, cachedValue)

            const middlewareResult = callMiddleware(middleware, 'passThroughQuery', 'enterSelectionSet', node, cacheStack, cacheKey)

            if (middlewareResult != null) {
              return middlewareResult
            }
          }
        } else {
          const middlewareResult = callMiddleware(middleware, 'passThroughQuery', 'enterField', node, cacheStack, cacheKey)

          if (middlewareResult !== undefined) {
            return middlewareResult
          }

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
          const cachedValue = getTopOfStack(cacheStack)

          if (Array.isArray(cachedValue)) {
            let hasFields = false
            let hasDeletedFields = false

            for (const selection of selectionSet.selections) {
              if (isMarkedForDeletion(selection)) {
                hasDeletedFields = true
              } else {
                hasFields = true
              }
            }

            if (hasFields && hasDeletedFields) {
              // array is querying for new fields, which means fetching from the server,
              // which means that now records could be returned from the server, WHICH MEANS (!!!)
              // we need to query for all fields in case of new records

              node = recursivelyMarkAsKeep(rootAst, node)
            }
          }

          const res = callMiddleware(middleware, 'passThroughQuery', 'leaveSelectionSet', node, cacheStack)

          popTopFromStack(cacheStack)

          if (res !== undefined) {
            return res
          }

          return node
        }
      }
    },

  })
}

function visitTreeDeleteNodes(ast) {
  return visit(ast, {
    enter(node) {
      if (isMarkedForDeletion(node) && node.kind === 'Field') {
        return VISIT_REMOVE_NODE
      }
    },
    leave: removeEmptySelectionSets,
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
    leave: removeEmptySelectionSets,
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

function visitTreeDeleteUnusedVariables(ast) {
  let usedVariables = null

  return visit(ast, {
    enter(node) {
      if (node.kind === 'OperationDefinition' && node.operation === 'query') {
        usedVariables = []

        trackUsedVariables(ast, node, usedVariables)
        return
      }
    },
    leave(node) {
      if (node.kind === 'OperationDefinition' && node.operation === 'query') {
        return {
          ...node,
          variableDefinitions: node.variableDefinitions.filter(definition =>
            usedVariables.includes(definition.variable.name.value)
          ),
        }
      }
    },
  })
}

function trackUsedVariables(document, ast, usedVariables) {
  return visit(ast, {
    enter(node) {
      if (node.kind === 'VariableDefinition') {
        return false
      }

      if (node.kind === 'Variable') {
        const variableName = node.name.value

        usedVariables.push(variableName)
        return
      }

      if (node.kind === 'FragmentSpread') {
        const nameOfFragment = node.name.value
        const fragment = getFragment(document, nameOfFragment)

        if (!fragment) {
          return
        }

        trackUsedVariables(document, fragment, usedVariables)
      }
    },
  })
}

function removeEmptySelectionSets(node) {
  // remove empty fragments
  if (node.selectionSet && node.selectionSet.selections.length === 0) {
    return VISIT_REMOVE_NODE
  }

  if (node.kind === 'InlineFragment' && node.selectionSet === null) {
    return VISIT_REMOVE_NODE
  }
}

function getFragment(ast, name) {
  if (ast.kind !== 'Document') {
    throw new Error('getFragment(): ast.kind is not Document')
  }

  const { definitions } = ast

  return definitions.find(def => def.name && def.name.value === name)
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

function visitArray(rootAst, node, cacheStack, cacheKey, variables, middleware) {
  const cacheStackTop = getTopOfStack(cacheStack)

  let lastAst = node

  cacheStackTop.forEach(element => {
    pushToStack(cacheStack, element)
    callMiddleware(middleware, 'passThroughQuery', 'enterSelectionSet', lastAst, cacheStack, cacheKey)

    lastAst = {
      ...lastAst,
      selectionSet: visitTree(rootAst, lastAst.selectionSet, cacheStack, variables, middleware, true),
    }

    const middlewareResult = callMiddleware(middleware, 'passThroughQuery', 'leaveSelectionSet', lastAst, cacheStack)
    popTopFromStack(cacheStack)

    if (middlewareResult != null) {
      lastAst = middlewareResult
    }
  })

  return lastAst
}
