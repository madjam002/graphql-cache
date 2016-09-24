import {visit} from 'graphql/language/visitor'

/**
 * Takes a query AST and simplifies it.
 *
 * This involves removing unused fragments, inlining fragments with the query selection sets,
 * and replacing variable references with their actual values.
 */
export function simplifyAst(ast, variables = {}) {
  let insideQuery = false

  return visit(ast, {
    enter(node, key, parent, path, ancestors) {
      if (node.kind === 'OperationDefinition' && node.operation === 'query') {
        insideQuery = true
        return
      }

      if (insideQuery && node.kind === 'FragmentSpread') {
        const nameOfFragment = node.name.value
        const fragment = getFragment(ast, nameOfFragment)

        if (fragment) {
          return fragment.selectionSet
        }
      }

      if (insideQuery && node.kind === 'Variable') {
        const variableName = node.name.value

        if (variables[variableName] == null) {
          throw new Error(`simplifyAst(): Variable referenced "${variableName}" but not provided`)
        }

        return {
          kind: 'StringValue',
          value: variables[variableName].toString(),
        }
      }

      if (node.kind === 'FragmentDefinition') {
        // be gone! remove fragments because we inlined them
        return null
      }
    },

    leave(node, key, parent, path, ancestors) {
      if (node.kind === 'OperationDefinition' && node.operation === 'query') {
        insideQuery = false
        return
      }
    },
  })
}

function getFragment(ast, name) {
  if (ast.kind !== 'Document') {
    throw new Error('getFragment(): ast.kind is not Document')
  }

  const { definitions } = ast

  return definitions.find(def => def.name && def.name.value === name)
}
