export function rgbToHex(rgb) {
    if (!rgb) return rgb;
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*[\d.]+)?\)/i);
    if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return rgb;
}

export function isValidColor(color) {
    if (typeof color !== 'string') return false;

    // HEX (#rgb, #rrggbb)
    if (/^#([0-9a-fA-F]{3}){1,2}$/.test(color)) return true;

    // rgb() или rgba()
    const rgbRegex =
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|0?\.\d+|1(\.0)?))?\s*\)$/;

    const match = color.match(rgbRegex);
    if (match) {
        const r = +match[1],
            g = +match[2],
            b = +match[3];
        return !(r > 255 || g > 255 || b > 255);

    }

    return false;
}

export function normalizeColor(color) {
    if (!color) return '';
    if (color.startsWith('rgb')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(,\s*[\d.]+)?\)/i);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`.toLowerCase();
        }
    }
    if (color.startsWith('#')) {
        if (color.length === 4) {
            return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
        }
        return color.toLowerCase();
    }
    return color;
}
