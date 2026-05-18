import DataLocationSettingsPanel from './DataLocationSettingsPanel'
import IngestionPanel from './IngestionPanel'

export default function DatabaseSettings() {
  return (
    <div className="flex flex-col gap-8">
      <IngestionPanel />
      <DataLocationSettingsPanel />
    </div>
  )
}
