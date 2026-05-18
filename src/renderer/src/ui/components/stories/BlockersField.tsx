import { Field } from 'thefactory-ui/web'
import { Textarea } from 'thefactory-ui/web'

export type BlockersFieldProps = {
  value: string[]
  onChange: (next: string[]) => void
  rows?: number
}

/**
 * Free-text blockers editor — one blocker per line. Empty lines are dropped on
 * commit. The on-screen state is the raw text so the user can edit naturally;
 * conversion to/from string[] happens at the boundary.
 */
export default function BlockersField({ value, onChange, rows = 3 }: BlockersFieldProps) {
  return (
    <Field
      label="Blockers (optional)"
      hint="One blocker per line — what's stopping this from moving forward."
    >
      <Textarea
        value={value.join('\n')}
        onChange={(e) =>
          onChange(
            e.target.value
              .split('\n')
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          )
        }
        rows={rows}
        placeholder="Waiting on backend route X
Needs design review"
      />
    </Field>
  )
}
