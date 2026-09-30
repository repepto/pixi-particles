export function getById<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing element: ${id}`);
    }

    return element as T;
}

export function getInputValue(id: string): string {
    return getById<HTMLInputElement | HTMLSelectElement>(id).value;
}

export function getInputNumber(id: string): number {
    return Number(getInputValue(id));
}

export function getInputChecked(id: string): boolean {
    return getById<HTMLInputElement>(id).checked;
}
