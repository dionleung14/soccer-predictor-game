/**
 * Shared brand palette — keep in sync with CSS vars in `styles/palette.css`.
 * Hex values: charcoal, stone, green, periwinkle, terracotta.
 */
export const palette = {
  charcoal: '#393E41',
  stone: '#D3D0CB',
  green: '#5A9367',
  periwinkle: '#8783D1',
  terracotta: '#A5402D',
}

export const paletteRgb = {
  charcoal: '57, 62, 65',
  stone: '211, 208, 203',
  green: '90, 147, 103',
  periwinkle: '135, 131, 209',
  terracotta: '165, 64, 45',
}

/** Convenience aliases for common UI roles */
export const colors = {
  ink: palette.charcoal,
  surface: palette.stone,
  accent: palette.green,
  accentAlt: palette.periwinkle,
  danger: palette.terracotta,
}
