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
  // Setup errors — these mean the Firebase project isn't finished, not that
  // the person did anything wrong, so say what to actually go fix.
  'auth/configuration-not-found':
    'This Firebase project doesn’t have Authentication turned on yet. In the Firebase console, go to Authentication → Sign-in method → Email/Password → Enable.',
  'auth/operation-not-allowed':
    'Email/password sign-in isn’t enabled for this Firebase project. Turn it on under Authentication → Sign-in method.',
  'auth/api-key-not-valid': 'The Firebase API key in .env isn’t valid for this project.',
}

export function friendlyAuthError(error) {
  return MESSAGES[error?.code] ?? error?.message ?? 'Something went wrong. Try again.'
}
