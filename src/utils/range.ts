import {
	parsePlannerRangeBasename,
	type ParsedRangeBasename,
} from "./planner-basename";

export type ParsedRange = ParsedRangeBasename;

/**
 * Parse a range basename into canonical `YYYY-MM-DD` start/end (+ optional
 * suffix). Honors the configured filename date format.
 */
export function parseRangeBasename(basename: string): ParsedRange | null {
	return parsePlannerRangeBasename(basename);
}

export function isDateInRange(
	dateStr: string,
	start: string,
	end: string,
): boolean {
	return dateStr >= start && dateStr <= end;
}
