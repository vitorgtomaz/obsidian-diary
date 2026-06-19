import Holidays from "date-holidays";

export type HolidayFilterTypes = "public" | "bank" | "school" | "optional" | "observance";

export interface HolidayData {
	dates: Set<string>;
	names: Map<string, string[]>;
}

/**
 * Get public holiday dates and names for a given country and year.
 * @param country - ISO 3166-1 alpha-2 country code (e.g. KR, US, JP)
 * @param year - Calendar year
 * @param types - Holiday types to include. Default: ["public"] only.
 * @returns Object with `dates` (Set of YYYY-MM-DD) and `names` (Map of date → holiday names[])
 */
export function getHolidaysForYear(
	country: string,
	year: number,
	types: HolidayFilterTypes[] = ["public"],
): HolidayData {
	const hd = new Holidays(country);
	const holidays = hd.getHolidays(year) ?? [];
	const dates = new Set<string>();
	const names = new Map<string, string[]>();

	for (const h of holidays) {
		const typeMatch = types.length === 0 || types.includes(h.type ?? "public");
		if (!typeMatch || !h.date) continue;

		const [datePart] = h.date.split(" ");
		if (!datePart) continue;

		dates.add(datePart);
		if (h.name) {
			const existing = names.get(datePart) ?? [];
			existing.push(h.name);
			names.set(datePart, existing);
		}
	}

	return { dates, names };
}

/**
 * Merge public holidays for several countries into one dataset.
 * @param countries - ISO 3166-1 alpha-2 country codes.
 * @param year - Calendar year.
 * @param types - Holiday types to include. Default: ["public"] only.
 */
export function getHolidaysForCountries(
	countries: string[],
	year: number,
	types: HolidayFilterTypes[] = ["public"],
): HolidayData {
	const dates = new Set<string>();
	const names = new Map<string, string[]>();

	for (const rawCountry of countries) {
		const country = rawCountry.trim();
		if (!country) continue;
		let data: HolidayData;
		try {
			data = getHolidaysForYear(country, year, types);
		} catch {
			continue;
		}
		for (const date of data.dates) dates.add(date);
		for (const [date, countryNames] of data.names) {
			const existing = names.get(date) ?? [];
			for (const name of countryNames) {
				if (!existing.includes(name)) existing.push(name);
			}
			names.set(date, existing);
		}
	}

	return { dates, names };
}
