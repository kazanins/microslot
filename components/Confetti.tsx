'use client'

const pieces = Array.from({ length: 80 }, (_, index) => {
  const left = (index * 37) % 100
  const size = 6 + (index % 6)
  const height = size * 2
  const delay = (index % 20) * 0.08
  const duration = 2.8 + (index % 12) * 0.15
  const isDark = index % 2 === 0

  return {
    key: `${index}-${left}`,
    left,
    width: size,
    height,
    delay,
    duration,
    color: isDark ? '#111111' : '#f5f5f5',
    border: isDark ? 'none' : '1px solid #111111',
  }
})

export function Confetti() {
  return (
    <div className="tempo-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.key}
          className="tempo-confetti__piece"
          style={{
            left: `${piece.left}%`,
            width: `${piece.width}px`,
            height: `${piece.height}px`,
            backgroundColor: piece.color,
            border: piece.border,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
