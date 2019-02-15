// @flow
function hell2u (x: ?number): string {
  if (x) {
    return x
  }
  return 'I will give you hell'
}

hell2u(42)
