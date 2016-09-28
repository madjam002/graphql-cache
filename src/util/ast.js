import {visit} from 'graphql/language/visitor'
import invariant from 'invariant'

/**
 * Takes a query AST and simplifies it.
 *
 * This involves removing unused fragments, inlining fragments with the query selection sets,
 * and replacing variable references with their actual values.
 */
export function simplifyAst(ast, variables = {}) {
  let insideQuery = false

  const definedVariables = []

  return visit(ast, {
    enter(node, key, parent, path, ancestors) {
      if (node.kind === 'OperationDefinition' && node.operation === 'query') {
        insideQuery = true

        if (node.variableDefinitions) {
          for (const definition of node.variableDefinitions) {
            definedVariables.push(definition.variable.name.value)
          }
        }

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

        invariant(definedVariables.includes(variableName), `simplifyAst(): Undefined variable referenced "${variableName}"`)
        invariant(variables[variableName] !== undefined, `simplifyAst(): Variable referenced "${variableName}" but not provided`)

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

/**
 * Returns a new node with selectionSet, where the selectionSet will contain
 * the given field.
 */
export function ensureSelectionSetHasField(node, field) {
  invariant(node, 'queryForField(): node not provided')
  invariant(node.selectionSet, 'queryForField(): node does not have selectionSet')

  return {
    ...node,
    selectionSet: {
      ...node.selectionSet,
      selections: ensureSelectionsHasField(node.selectionSet.selections, field),
    },
  }
}

/**
 * Returns an array of field names which are being queried in a selection set
 */
export function fieldsInSelectionSet(node) {
  invariant(node, 'queryForField(): node not provided')
  invariant(node.selectionSet, 'queryForField(): node does not have selectionSet')

  return node.selectionSet.selections
  .filter(node => !node.__shouldDelete && node.name)
  .filter(node => !node.selectionSet || fieldsInSelectionSet(node).length > 0)
  .map(node => node.name.value)
}

function getFragment(ast, name) {
  invariant(ast.kind === 'Document', 'getFragment(): ast.kind is not Document')

  const { definitions } = ast

  return definitions.find(def => def.name && def.name.value === name)
}

function ensureSelectionsHasField(selections, field) {
  invariant(Array.isArray(selections), 'ensureSelectionsHasField(): selections is not array')

  const exists = selections.find(node => node.kind === 'Field' && node.name && node.name.value === field)

  if (exists && exists.__shouldDelete) {
    return selections.map(node =>
      node === exists
      ? {
        ...exists,
        __shouldDelete: false,
      }
      : node
    )
  }

  if (!exists) {
    return [
      ...selections,
      {
        kind: 'Field',
        alias: null,
        name: { kind: 'Name', value: field },
        arguments: [],
        directives: [],
        selectionSet: null,
      },
    ]
  }

  return selections
}
