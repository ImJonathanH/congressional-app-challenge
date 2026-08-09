/** Firebase's error codes are not something to show a person. */
const MESSAGES = {
  'auth/email-already-in-use': 'That email already has an account. Try signing in instead.',
  'auth/invalid-email': 'That doesn’t look like a valid email address.',
  'auth/weak-password': 'Passwords need to be at least 6 characters.',
  'auth/invalid-credential': 'That email and password don’t match an account.',
  'auth/user-not-found': 'No account with that email yet.',
  'auth/wrong-password': 'That password isn’t right.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Couldn’t reach Firebase. Check your connection.',
}

export function friendlyAuthError(error) {
  return MESSAGES[error?.code] ?? error?.message ?? 'Something went wrong. Try again.'
}
