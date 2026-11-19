import {
  CROSS_PROJECT_RESUME_COPY,
  CROSS_PROJECT_RESUME_OPTIONS,
  useCrossProjectSettings,
} from 'thefactory-ui/headless'
import { NativeSelect } from 'thefactory-ui/web'

export default function GlobalCrossProjectSettings(): React.JSX.Element {
  const { loading, global, setGlobal, resume } = useCrossProjectSettings()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold">Cross-project requests</h2>
        <p className="text-sm text-(--text-secondary)">
          How your projects handle feature requests that other projects (or their agents) send them.
        </p>
      </div>
      <label className="block space-y-1.5 text-sm font-medium">
        <span className="block">Accepting requests — default for all projects</span>
        <NativeSelect
          value={global}
          disabled={loading}
          onChange={(event) => {
            const value = event.target.value
            if (value === 'manual' || value === 'off') void setGlobal(value)
          }}
        >
          <option value="manual">Manual — hold for my approval</option>
          <option value="off">Off — decline inbound requests</option>
        </NativeSelect>
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        <span className="block">{CROSS_PROJECT_RESUME_COPY.label}</span>
        <NativeSelect
          value={resume.global}
          disabled={loading}
          onChange={(event) => {
            const option = CROSS_PROJECT_RESUME_OPTIONS.find(
              ({ value }) => value === event.target.value,
            )
            if (option) void resume.setGlobal(option.value)
          }}
        >
          {CROSS_PROJECT_RESUME_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>
    </div>
  )
}
