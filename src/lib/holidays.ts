export interface HolidayLike {
  date: string;
  is_movable: boolean;
}

/**
 * Vérifie qu'un jour férié est une fête religieuse mobile future.
 * Le badge « À confirmer » ne doit s'afficher que dans ce cas.
 */
export function isFutureMovableHoliday(
  holiday: HolidayLike,
  referenceDate: Date = new Date(),
): boolean {
  if (!holiday.is_movable) return false;

  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const d = new Date(holiday.date);
  d.setHours(0, 0, 0, 0);

  return d >= ref;
}
