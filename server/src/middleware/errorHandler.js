export function errorHandler(err, _req, res, _next) {
  console.error(err)
  res.status(502).json({
    error: 'Upstream request failed',
    detail: err instanceof Error ? err.message : String(err),
  })
}
