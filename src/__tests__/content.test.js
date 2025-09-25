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

describe('findTextByColor - extra cases', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div style="color: rgb(255,0,0)">Hello</div>
            <div style="color: #00ff00">Green</div>
            <div style="color: rgba(0,0,255,0.5)">Blue with alpha</div>
            <div style="color: #000000">Black</div>
            <div>No color</div>
        `;
    });

    test('matches rgba with alpha transparency', () => {
        const results = findTextByColor('#0000ff'); // синий без альфа
        expect(results).toHaveLength(1);
        expect(results[0].text).toBe('Blue with alpha');
    });

    test('matches case-insensitive hex', () => {
        const results = findTextByColor('#00FF00'); // зелёный
        expect(results).toHaveLength(1);
        expect(results[0].text).toBe('Green');
    });

    test('ignores hidden elements', () => {
        const hiddenDiv = document.querySelector('div:nth-child(4)');
        hiddenDiv.style.display = 'none';
        const results = findTextByColor('#000000');
        expect(results).toHaveLength(0);
    });

    test('matches color even with extra spaces', () => {
        document.body.innerHTML += `<span style="color: rgb(255, 0, 0)">  Padded  </span>`;
        const results = findTextByColor('rgb(255,0,0)');
        expect(results.some(r => r.text === 'Padded')).toBe(true);
    });

});
