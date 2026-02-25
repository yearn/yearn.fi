export function scoreColor(score: number): string {
  if (score <= 1.5) {
    return '#22C55E'
  }
  if (score <= 2.5) {
    return '#86EFAC'
  }
  if (score <= 3.5) {
    return '#FACC15'
  }
  if (score <= 4.5) {
    return '#FB923C'
  }
  return '#EF4444'
}

export function scoreTier(score: number): string {
  if (score <= 1.5) {
    return 'Minimal Risk'
  }
  if (score <= 2.5) {
    return 'Low Risk'
  }
  if (score <= 3.5) {
    return 'Medium Risk'
  }
  if (score <= 4.5) {
    return 'Elevated Risk'
  }
  return 'High Risk'
}

export function scoreTextColor(score: number): string {
  if (score <= 3.5) {
    return '#0C0C0C'
  }
  return '#FFFFFF'
}
