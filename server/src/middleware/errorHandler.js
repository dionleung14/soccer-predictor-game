export function errorHandler(err, _req, res, _next) {
  console.error(err)

  if (err?.code === 'ECONNREFUSED' || err?.code === 'ER_ACCESS_DENIED_ERROR') {
    res.status(503).json({
      error: 'Database unavailable',
      detail: err instanceof Error ? err.message : String(err),
    })
    return
  }

  res.status(502).json({
    error: 'Upstream request failed',
    detail: err instanceof Error ? err.message : String(err),
  })
}
