export function ExperimentalBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-secondary-200 bg-secondary-50 px-4 py-3">
      <span className="text-lg leading-none">🧪</span>
      <p className="text-sm font-medium text-secondary-800">
        Servizio attualmente in fase di sperimentazione accessibile solo su invito.
      </p>
    </div>
  );
}
