import { normalizeColor } from './utils';

export function findTextByColor(targetColor) {
    const normalizedTarget = normalizeColor(targetColor);
    const textElements = document.querySelectorAll('*');
    const found = [];
    textElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (normalizeColor(style.color) === normalizedTarget) {
            found.push({ text: el.textContent.trim(), color: style.color });
        }
    });
    return found;
}
