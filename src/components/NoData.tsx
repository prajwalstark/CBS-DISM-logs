import { Glass } from './Glass';
import { Dropzone } from './Dropzone';

export function NoData({ what }: { what: string }) {
  return (
    <Glass className="mx-auto max-w-2xl p-6 md:p-8">
      <h2 className="font-display text-lg font-semibold">No logs loaded</h2>
      <p className="mb-5 mt-1 text-sm text-ink-2">{what} is computed from parsed CBS/DISM logs. Load your logs to populate this view — nothing here is simulated.</p>
      <Dropzone compact />
    </Glass>
  );
}
