/**
 * Central encode/decode for planner note basenames.
 *
 * The whole codebase uses canonical `YYYY-MM-DD` strings as the internal date
 * representation (range comparisons, recurrence frontmatter, holiday keys, …).
 * The configurable date format only affects how dates are encoded into, and
 * decoded from, *filenames*. Parsers therefore always return canonical
 * `YYYY-MM-DD` strings, and formatters always take canonical strings as input.
 */

export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
const RANGE_SEPARATOR = "--";

export interface PlannerBasenameConfig {
	/** Filename date format using YYYY, YY, MM, DD tokens. */
	dateFormat: string;
	/** Optional raw regex override for matching single date notes. */
	customFileRegex: string;
}

export interface ParsedSingleBasename {
	/** Canonical YYYY-MM-DD. */
	date: string;
	suffix?: string;
}

export interface ParsedRangeBasename {
	/** Canonical YYYY-MM-DD. */
	start: string;
	/** Canonical YYYY-MM-DD. */
	end: string;
	suffix?: string;
}

type DateComponent = "year4" | "year2" | "month" | "day";

interface CompiledDateFormat {
	/** Regex source matching one date, one capture group per component. */
	source: string;
	/** Component for each capture group, in order. */
	components: DateComponent[];
	/** The format string this was compiled from. */
	format: string;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const pad4 = (n: number): string => String(n).padStart(4, "0");

function escapeRegExp(literal: string): string {
	return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tokens recognized in a date format. Longest first so YYYY beats YY. */
const FORMAT_TOKENS: ReadonlyArray<{
	token: string;
	component: DateComponent;
	group: string;
}> = [
	{ token: "YYYY", component: "year4", group: "(\\d{4})" },
	{ token: "YY", component: "year2", group: "(\\d{2})" },
	{ token: "MM", component: "month", group: "(\\d{2})" },
	{ token: "DD", component: "day", group: "(\\d{2})" },
];

function compileDateFormat(format: string): CompiledDateFormat | null {
	let source = "";
	const components: DateComponent[] = [];
	let i = 0;
	while (i < format.length) {
		const match = FORMAT_TOKENS.find((tk) => format.startsWith(tk.token, i));
		if (match) {
			source += match.group;
			components.push(match.component);
			i += match.token.length;
		} else {
			source += escapeRegExp(format.charAt(i));
			i += 1;
		}
	}
	const counts = new Map<DateComponent, number>();
	for (const c of components) counts.set(c, (counts.get(c) ?? 0) + 1);
	const hasYear =
		(counts.get("year4") ?? 0) + (counts.get("year2") ?? 0) === 1;
	const hasMonth = counts.get("month") === 1;
	const hasDay = counts.get("day") === 1;
	if (!hasYear || !hasMonth || !hasDay) return null;
	return { source, components, format };
}

const DEFAULT_COMPILED = compileDateFormat(DEFAULT_DATE_FORMAT) as CompiledDateFormat;

let activeFormat: CompiledDateFormat = DEFAULT_COMPILED;
let customSingleRegex: RegExp | null = null;
let singleRegexCache: { source: string; regex: RegExp } | null = null;
let rangeRegexCache: { source: string; regex: RegExp } | null = null;

function compileCustomRegex(src: string | undefined): RegExp | null {
	const trimmed = (src ?? "").trim();
	if (!trimmed) return null;
	try {
		return new RegExp(trimmed);
	} catch {
		return null;
	}
}

export function setPlannerBasenameConfig(
	config: Partial<PlannerBasenameConfig>,
): void {
	const requested = (config.dateFormat || DEFAULT_DATE_FORMAT).trim();
	activeFormat = compileDateFormat(requested) ?? DEFAULT_COMPILED;
	customSingleRegex = compileCustomRegex(config.customFileRegex);
	singleRegexCache = null;
	rangeRegexCache = null;
}

export function getPlannerDateFormat(): string {
	return activeFormat.format;
}

/** Example basename shown in placeholders/hints for the active format. */
export function getPlannerDateExample(): string {
	return formatPlannerDate("2026-02-27");
}

// --- canonical helpers ---

function isValidYmd(year: number, month: number, day: number): boolean {
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day)
	) {
		return false;
	}
	const date = new Date(year, month - 1, day);
	return (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	);
}

function toCanonical(year: number, month: number, day: number): string | null {
	if (!isValidYmd(year, month, day)) return null;
	return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

function parseCanonical(
	canonical: string,
): { year: number; month: number; day: number } | null {
	const m = canonical.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	const year = parseInt(m[1] ?? "", 10);
	const month = parseInt(m[2] ?? "", 10);
	const day = parseInt(m[3] ?? "", 10);
	if (!isValidYmd(year, month, day)) return null;
	return { year, month, day };
}

function componentsToCanonical(
	values: Array<string | undefined>,
	components: DateComponent[],
): string | null {
	let year = NaN;
	let month = NaN;
	let day = NaN;
	for (let i = 0; i < components.length; i++) {
		const raw = values[i];
		if (raw == null) return null;
		const n = parseInt(raw, 10);
		switch (components[i]) {
			case "year4":
				year = n;
				break;
			case "year2":
				year = 2000 + n;
				break;
			case "month":
				month = n;
				break;
			case "day":
				day = n;
				break;
		}
	}
	return toCanonical(year, month, day);
}

// --- formatting (canonical -> filename date) ---

export function formatPlannerDate(canonical: string): string {
	const parsed = parseCanonical(canonical);
	if (!parsed) return canonical;
	const { year, month, day } = parsed;
	const format = activeFormat.format;
	let out = "";
	let i = 0;
	while (i < format.length) {
		const match = FORMAT_TOKENS.find((tk) => format.startsWith(tk.token, i));
		if (match) {
			switch (match.component) {
				case "year4":
					out += pad4(year);
					break;
				case "year2":
					out += pad2(year % 100);
					break;
				case "month":
					out += pad2(month);
					break;
				case "day":
					out += pad2(day);
					break;
			}
			i += match.token.length;
		} else {
			out += format.charAt(i);
			i += 1;
		}
	}
	return out;
}

export function buildSingleBasename(
	canonical: string,
	suffix?: string | null,
): string {
	const base = formatPlannerDate(canonical);
	return suffix ? `${base}-${suffix}` : base;
}

export function buildRangeBasename(
	start: string,
	end: string,
	suffix?: string | null,
): string {
	const base = `${formatPlannerDate(start)}${RANGE_SEPARATOR}${formatPlannerDate(end)}`;
	return suffix ? `${base}-${suffix}` : base;
}

// --- parsing (filename -> canonical) ---

function buildSingleFormatRegex(): RegExp {
	if (!singleRegexCache || singleRegexCache.source !== activeFormat.source) {
		singleRegexCache = {
			source: activeFormat.source,
			regex: new RegExp(`^${activeFormat.source}(?:-(.+))?$`),
		};
	}
	return singleRegexCache.regex;
}

function buildRangeFormatRegex(): RegExp {
	if (!rangeRegexCache || rangeRegexCache.source !== activeFormat.source) {
		rangeRegexCache = {
			source: activeFormat.source,
			regex: new RegExp(
				`^${activeFormat.source}${escapeRegExp(RANGE_SEPARATOR)}${activeFormat.source}(?:-(.+))?$`,
			),
		};
	}
	return rangeRegexCache.regex;
}

function cleanBasename(basename: string): string {
	return basename.replace(/\.md$/i, "");
}

function pickGroup(
	groups: Record<string, string | undefined>,
	names: string[],
): string | undefined {
	for (const name of names) {
		if (groups[name] != null) return groups[name];
	}
	return undefined;
}

function parseWithCustomRegex(clean: string): ParsedSingleBasename | null {
	if (!customSingleRegex) return null;
	const m = clean.match(customSingleRegex);
	if (!m) return null;
	const groups = m.groups ?? {};
	const yearRaw = pickGroup(groups, ["year", "yyyy", "yy", "y"]);
	const monthRaw = pickGroup(groups, ["month", "mm", "m"]);
	const dayRaw = pickGroup(groups, ["day", "dd", "d"]);
	if (yearRaw == null || monthRaw == null || dayRaw == null) return null;
	const year =
		yearRaw.length <= 2 ? 2000 + parseInt(yearRaw, 10) : parseInt(yearRaw, 10);
	const canonical = toCanonical(
		year,
		parseInt(monthRaw, 10),
		parseInt(dayRaw, 10),
	);
	if (!canonical) return null;
	const suffixRaw = pickGroup(groups, ["suffix"]);
	return {
		date: canonical,
		suffix: suffixRaw ? suffixRaw : undefined,
	};
}

export function parsePlannerSingleBasename(
	basename: string,
): ParsedSingleBasename | null {
	const clean = cleanBasename(basename);
	// A range basename must never be treated as a single date note.
	if (parsePlannerRangeBasename(clean)) return null;
	const custom = parseWithCustomRegex(clean);
	if (custom) return custom;
	const m = clean.match(buildSingleFormatRegex());
	if (!m) return null;
	const n = activeFormat.components.length;
	const canonical = componentsToCanonical(m.slice(1, 1 + n), activeFormat.components);
	if (!canonical) return null;
	const suffix = m[1 + n];
	return { date: canonical, suffix: suffix ? suffix : undefined };
}

export function parsePlannerRangeBasename(
	basename: string,
): ParsedRangeBasename | null {
	const clean = cleanBasename(basename);
	const m = clean.match(buildRangeFormatRegex());
	if (!m) return null;
	const n = activeFormat.components.length;
	const start = componentsToCanonical(m.slice(1, 1 + n), activeFormat.components);
	const end = componentsToCanonical(
		m.slice(1 + n, 1 + 2 * n),
		activeFormat.components,
	);
	if (!start || !end || start > end) return null;
	const suffix = m[1 + 2 * n];
	return { start, end, suffix: suffix ? suffix : undefined };
}
