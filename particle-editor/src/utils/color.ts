export function hexColorToNumber(hexColor: string): number {
    return Number.parseInt(hexColor.replace("#", ""), 16);
}

export function numberToHexColor(color: number): string {
    return `#${color.toString(16).toUpperCase().padStart(6, "0")}`;
}
