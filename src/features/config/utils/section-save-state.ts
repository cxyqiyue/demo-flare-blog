/** Keep edits made elsewhere, or while a section's save request was pending. */
export function sectionSaveState<T extends object>(
  baseline: T,
  submitted: T,
  current: T,
  section: keyof T,
) {
  const defaults = { ...baseline, [section]: submitted[section] };
  const edits = (Object.keys(current) as Array<keyof T>)
    .filter(
      (key) => JSON.stringify(current[key]) !== JSON.stringify(defaults[key]),
    )
    .map((key) => [key, current[key]] as const);
  return { defaults, edits };
}
