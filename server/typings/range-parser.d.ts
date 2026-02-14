declare module 'range-parser' {
	export interface Range {
		start: number;
		end: number;
	}

	export interface Ranges extends Array<Range> {
		type?: string;
	}

	function rangeParser(size: number, str: string, options?: { combine?: boolean }): Ranges | -1 | -2;

	export = rangeParser;
}
