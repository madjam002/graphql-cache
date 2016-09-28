import {BREAK} from 'graphql/language/visitor'

export function callMiddleware(middleware, fnName, subFunc, node, ...otherArgs) {
  if (!middleware) return

  let newNode = node

  for (const middlewareDef of middleware) {
    if (middlewareDef[fnName] && middlewareDef[fnName][subFunc]) {
      const result = middlewareDef[fnName][subFunc](newNode, ...otherArgs)

      if (result === false) {
        return false
      }

      if (result === BREAK) {
        return BREAK
      }

      if (result === null) {
        return null
      }

      if (result !== undefined) {
        newNode = result
      }
    }
  }

  return newNode
}
