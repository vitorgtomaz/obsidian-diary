import { App, PluginSettingTab, Setting } from "obsidian";
import { setLocale, t } from "./i18n";
import DiaryObsidian from "./main";
import {
	ALTERNATE_CALENDAR_OPTIONS,
	type AlternateCalendarId,
	type AlternateCalendarSelection,
	normalizeAlternateCalendarId,
} from "./utils/alternate-calendars";
import type { PlannerFileScope } from "./views/yearly-planner/file-utils";
import { DEFAULT_DATE_FORMAT } from "./utils/planner-basename";

export interface DiaryObsidianSettings {
	locale: "en" | "ko";
	plannerFolder: string;
	plannerFileScope: PlannerFileScope;
	/** Folders (and subfolders) to scan exclusively. Empty = use plannerFileScope. */
	includeFolders: string[];
	/** Folders (and subfolders) to always skip. */
	excludeFolders: string[];
	/** Filename date format using YYYY, YY, MM, DD tokens. */
	dateFormat: string;
	/** Optional raw regex override for matching single date notes. */
	customFileRegex: string;
	showHolidays: boolean;
	/** ISO 3166-1 alpha-2 country codes to import holidays from. */
	holidayCountries: string[];
	/** Legacy migration field from the earlier single-country holiday setting. */
	holidayCountry?: string;
	alternateCalendarId: AlternateCalendarSelection;
	/** Legacy migration field from an interim multi-calendar toggle build. */
	enabledAlternateCalendars?: AlternateCalendarId[];
	/** Legacy migration field from the earlier single Korean-lunar toggle. */
	showLunarDates?: boolean;
	/** Mobile only: bottom padding (rem) so table isn't covered by Obsidian tools tab. 0 = use default. */
	mobileBottomPadding: number;
	/** Mobile only: month cell width (rem). 0 = use default. */
	mobileCellWidth: number;
	/** Whether the plan note panel (document preview) is expanded. Persists across devices via vault sync. */
	planNotePanelExpanded?: boolean;
	/** Mobile-only plan note expanded state. Defaults collapsed until toggled on mobile. */
	mobilePlanNotePanelExpanded?: boolean;
	/** Month columns expanded in the yearly planner. Persists across reloads. */
	yearlyPlannerExpandedMonths: number[];
}

export const CURATED_HOLIDAY_COUNTRIES: readonly string[] = [
	"KR",
	"US",
	"JP",
	"CN",
	"GB",
	"DE",
	"FR",
	"AU",
	"CA",
	"TW",
];

function parseCsvList(value: string): string[] {
	const seen = new Set<string>();
	for (const part of value.split(",")) {
		const trimmed = part.trim();
		if (trimmed) seen.add(trimmed);
	}
	return Array.from(seen);
}

export const DEFAULT_SETTINGS: DiaryObsidianSettings = {
	locale: "en",
	plannerFolder: "Planner",
	plannerFileScope: "vault",
	includeFolders: [],
	excludeFolders: [],
	dateFormat: "YYYY-MM-DD",
	customFileRegex: "",
	showHolidays: true,
	holidayCountries: ["KR"],
	alternateCalendarId: "",
	mobileBottomPadding: 3.5,
	mobileCellWidth: 4.5,
	planNotePanelExpanded: true,
	mobilePlanNotePanelExpanded: false,
	yearlyPlannerExpandedMonths: [],
};

export class DiaryObsidianSettingTab extends PluginSettingTab {
	plugin: DiaryObsidian;

	constructor(app: App, plugin: DiaryObsidian) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName(t("settings.language"))
			.setDesc(t("settings.languageDesc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("en", "English")
					.addOption("ko", "한국어")
					.setValue(this.plugin.settings.locale ?? "en")
					.onChange(async (value) => {
						this.plugin.settings.locale =
							value === "ko" ? "ko" : "en";
						setLocale(this.plugin.settings.locale);
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.plannerFolder"))
			.setDesc(t("settings.plannerFolderDesc"))
			.addText((text) =>
				text
					.setPlaceholder("Planner")
					.setValue(this.plugin.settings.plannerFolder)
					.onChange(async (value) => {
						this.plugin.settings.plannerFolder = value || "Planner";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.plannerFileScope"))
			.setDesc(t("settings.plannerFileScopeDesc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("vault", t("settings.plannerFileScopeVault"))
					.addOption(
						"plannerFolder",
						t("settings.plannerFileScopeFolder"),
					)
					.setValue(this.plugin.settings.plannerFileScope ?? "vault")
					.onChange(async (value) => {
						this.plugin.settings.plannerFileScope =
							value === "plannerFolder" ? "plannerFolder" : "vault";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.dateFormat"))
			.setDesc(t("settings.dateFormatDesc"))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_DATE_FORMAT)
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value || "YYYY-MM-DD";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.customFileRegex"))
			.setDesc(t("settings.customFileRegexDesc"))
			.addText((text) =>
				text
					.setPlaceholder("^(?<year>\\d{4})(?<month>\\d{2})(?<day>\\d{2})")
					.setValue(this.plugin.settings.customFileRegex)
					.onChange(async (value) => {
						this.plugin.settings.customFileRegex = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.includeFolders"))
			.setDesc(t("settings.includeFoldersDesc"))
			.addText((text) =>
				text
					.setPlaceholder(t("settings.includeFoldersPlaceholder"))
					.setValue(this.plugin.settings.includeFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.includeFolders = parseCsvList(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.excludeFolders"))
			.setDesc(t("settings.excludeFoldersDesc"))
			.addText((text) =>
				text
					.setPlaceholder(t("settings.excludeFoldersPlaceholder"))
					.setValue(this.plugin.settings.excludeFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.excludeFolders = parseCsvList(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.showHolidays"))
			.setDesc(t("settings.showHolidaysDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showHolidays)
					.onChange(async (value) => {
						this.plugin.settings.showHolidays = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.holidayCountries"))
			.setDesc(t("settings.holidayCountriesDesc"))
			.addText((text) =>
				text
					.setPlaceholder(t("settings.holidayCountriesPlaceholder"))
					.setValue(this.plugin.settings.holidayCountries.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.holidayCountries = parseCsvList(
							value.toUpperCase(),
						);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.addHolidayCountry"))
			.setDesc(t("settings.addHolidayCountryDesc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("", t("settings.addHolidayCountryPick"));
				for (const code of CURATED_HOLIDAY_COUNTRIES) {
					dropdown.addOption(code, t(`country.${code}`));
				}
				return dropdown.setValue("").onChange(async (value) => {
					if (!value) return;
					const current = this.plugin.settings.holidayCountries;
					if (!current.includes(value)) {
						this.plugin.settings.holidayCountries = [...current, value];
						await this.plugin.saveSettings();
					}
					this.display();
				});
			});

		const locale = this.plugin.settings.locale ?? "en";

		new Setting(containerEl)
			.setName(t("settings.alternateCalendar"))
			.setDesc(t("settings.alternateCalendarDesc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("", t("settings.alternateCalendarNone"));
				for (const option of ALTERNATE_CALENDAR_OPTIONS) {
					dropdown.addOption(option.id, option.text[locale].name);
				}
				return dropdown
					.setValue(
						normalizeAlternateCalendarId(
							this.plugin.settings.alternateCalendarId,
							this.plugin.settings.enabledAlternateCalendars,
							this.plugin.settings.showLunarDates,
						),
					)
					.onChange(async (value) => {
						this.plugin.settings.alternateCalendarId =
							normalizeAlternateCalendarId(value);
						delete this.plugin.settings.enabledAlternateCalendars;
						delete this.plugin.settings.showLunarDates;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t("settings.mobileBottomPadding"))
			.setDesc(t("settings.mobileBottomPaddingDesc"))
			.addSlider((slider) =>
				slider
					.setLimits(0, 8, 0.5)
					.setValue(this.plugin.settings.mobileBottomPadding)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.mobileBottomPadding = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("settings.mobileCellWidth"))
			.setDesc(t("settings.mobileCellWidthDesc"))
			.addSlider((slider) =>
				slider
					.setLimits(0, 8, 0.25)
					.setValue(this.plugin.settings.mobileCellWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.mobileCellWidth = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
