export function parseRoles(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function mapUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    screenName: row.screen_name,
    email: row.email,
    roles: parseRoles(row.roles),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase().slice(0, 255)
}
