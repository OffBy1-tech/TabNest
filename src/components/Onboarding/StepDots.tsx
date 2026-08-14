import React from 'react'
import { type Step, TOTAL_STEPS } from './steps'

export interface StepDotsProps {
  step: Step
}

/** Progress dots for the onboarding flow, announcing "Step N of 3". */
export function StepDots({ step }: StepDotsProps): React.JSX.Element {
  return (
    <div
      aria-label={`Step ${step} of ${TOTAL_STEPS}`}
      aria-live="polite"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        justifyContent: 'center',
        marginBottom: 'var(--space-6)',
      }}
    >
      {([1, 2, 3] as Step[]).map((n) => (
        <span
          key={n}
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full)',
            backgroundColor:
              step === n ? 'var(--color-brand-500)' : 'var(--border-strong)',
            transition: `background-color var(--duration-base) var(--ease-default)`,
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  )
}
