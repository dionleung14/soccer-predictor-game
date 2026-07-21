import argon2 from 'argon2'

/** OWASP-recommended argon2id baseline parameters (approx). */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

export function validatePassword(password, { email } = {}) {
  if (typeof password !== 'string') {
    return 'Password is required'
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
  }
  if (/\s/.test(password)) {
    return 'Password must not contain spaces'
  }
  if (email && password.toLowerCase() === String(email).trim().toLowerCase()) {
    return 'Password must not match your email address'
  }
  return null
}

export async function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(passwordHash, password) {
  return argon2.verify(passwordHash, password)
}
