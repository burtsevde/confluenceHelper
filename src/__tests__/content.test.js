import { findTextByColor } from '../content-helpers.js';

describe('findTextByColor', () => {
    beforeEach(() => {
        document.body.innerHTML = `
      <div style="color: rgb(255,0,0)">Hello</div>
      <div style="color: rgb(0,0,255)">World</div>
      <div>No color</div>
    `;
    });

    test('finds element with matching rgb color', () => {
        const results = findTextByColor('rgb(255,0,0)');
        expect(results).toHaveLength(1);
        expect(results[0].text).toBe('Hello');
    });

    test('finds element with hex color equivalent', () => {
        const results = findTextByColor('#0000ff');
        expect(results).toHaveLength(1);
        expect(results[0].text).toBe('World');
    });

    test('returns empty array when no match', () => {
        const results = findTextByColor('#00ff00');
        expect(results).toHaveLength(0);
    });

    test('ignores elements without color style', () => {
        const results = findTextByColor('rgb(0,0,0)');
        expect(results).toHaveLength(0);
    });

    test('trims textContent in results', () => {
        document.body.innerHTML = `<span style="color: rgb(255,0,0)">   Trimmed   </span>`;
        const results = findTextByColor('rgb(255,0,0)');
        expect(results[0].text).toBe('Trimmed');
    });
});
