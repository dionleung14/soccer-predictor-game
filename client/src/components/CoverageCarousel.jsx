import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FREE_TIER_COVERAGE } from '../freeTierCoverage'

const AUTO_MS = 6500
const FADE_MS = 1200

function Emblem({ competition, active }) {
  const [failed, setFailed] = useState(false)
  const initials = competition.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  if (failed || !competition.emblem) {
    return (
      <div className="coverage-carousel__fallback" aria-hidden="true">
        {initials}
      </div>
    )
  }

  return (
    <img
      className={
        active
          ? 'coverage-carousel__emblem is-active'
          : 'coverage-carousel__emblem'
      }
      src={competition.emblem}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

export default function CoverageCarousel() {
  const slides = FREE_TIER_COVERAGE
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (paused || reduceMotion.current || slides.length < 2) return undefined

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length)
    }, AUTO_MS)

    return () => window.clearInterval(id)
  }, [paused, slides.length])

  const goTo = (next) => {
    setIndex((next + slides.length) % slides.length)
  }

  const current = slides[index]

  return (
    <section
      className="coverage-carousel"
      aria-roledescription="carousel"
      aria-label="Free-tier competitions available for prediction contests"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false)
        }
      }}
    >
      <div className="coverage-carousel__intro">
        <h2>Contests you can predict</h2>
        <p>
          Inspired by {' '}
          <a
            href="https://www.football-data.org/coverage"
            target="_blank"
            rel="noreferrer"
          >
            football-data.org
          </a>
          — leagues and cups spanning clubs, nations, and continents.
        </p>
      </div>

      <div className="coverage-carousel__stage">
        {slides.map((competition, i) => {
          const isActive = i === index
          return (
            <article
              key={competition.code}
              className={
                isActive
                  ? 'coverage-carousel__slide is-active'
                  : 'coverage-carousel__slide'
              }
              aria-hidden={!isActive}
              data-tone={competition.type.toLowerCase()}
              data-region={competition.region.toLowerCase().replace(/\s+/g, '-')}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            >
              <div className="coverage-carousel__visual">
                <Emblem competition={competition} active={isActive} />
              </div>
              <div className="coverage-carousel__copy">
                <p className="coverage-carousel__meta">
                  <span>{competition.region}</span>
                  <span aria-hidden="true">·</span>
                  <span>{competition.type}</span>
                </p>
                <h3>{competition.name}</h3>
                {competition.path ? (
                  <Link to={competition.path} className="coverage-carousel__cta">
                    Open contest
                  </Link>
                ) : (
                  <p className="coverage-carousel__soon">Coming soon as a contest</p>
                )}
              </div>
            </article>
          )
        })}

        <div className="coverage-carousel__controls">
          <button
            type="button"
            className="coverage-carousel__nav"
            onClick={() => goTo(index - 1)}
            aria-label="Previous competition"
          >
            ‹
          </button>
          <div className="coverage-carousel__dots" role="tablist" aria-label="Slides">
            {slides.map((competition, i) => (
              <button
                key={competition.code}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${competition.name}, ${competition.region}`}
                className={
                  i === index
                    ? 'coverage-carousel__dot is-active'
                    : 'coverage-carousel__dot'
                }
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="coverage-carousel__nav"
            onClick={() => goTo(index + 1)}
            aria-label="Next competition"
          >
            ›
          </button>
        </div>

        <p className="coverage-carousel__status" aria-live="polite">
          {current.name} — {current.region}
        </p>
      </div>
    </section>
  )
}
