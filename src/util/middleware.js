export function callMiddleware(middleware, fnName, subFunc, ...args) {
  if (!middleware) return

  for (const middlewareDef of middleware) {
    if (middlewareDef[fnName] && middlewareDef[fnName][subFunc]) {
      middlewareDef[fnName][subFunc](...args)
    }
  }
}
