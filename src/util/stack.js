export function getNewStackFrom(obj) {
  return [obj]
}

export function getTopOfStack(stack) {
  return stack[stack.length - 1]
}

export function pushToStack(stack, obj) {
  return stack.push(obj)
}

export function popTopFromStack(stack) {
  return stack.pop()
}
