import { normalizeColor, rgbToHex, isValidColor } from '../utils.js';

describe('Color utilities', () => {
    test('normalizeColor handles rgb to hex conversion', () => {
        expect(normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000');
    });

    test('normalizeColor handles rgba by ignoring alpha', () => {
        expect(normalizeColor('rgba(255, 128, 64, 0.5)')).toBe('#ff8040');
    });

    test('normalizeColor expands short hex to full hex', () => {
        expect(normalizeColor('#abc')).toBe('#aabbcc');
    });

    test('normalizeColor returns lowercase hex', () => {
        expect(normalizeColor('#ABCDEF')).toBe('#abcdef');
    });

    test('normalizeColor returns input if unknown format', () => {
        expect(normalizeColor('blue')).toBe('blue');
    });

    test('rgbToHex returns unchanged hex input', () => {
        expect(rgbToHex('#123456')).toBe('#123456');
    });

    test('rgbToHex converts rgb correctly', () => {
        expect(rgbToHex('rgb(0, 128, 64)')).toBe('#008040');
    });

    test('isValidColor detects valid short and long hex', () => {
        expect(isValidColor('#fff')).toBe(true);
        expect(isValidColor('#ffffff')).toBe(true);
    });

    test('isValidColor detects rgb and rgba formats', () => {
        expect(isValidColor('rgb(0,0,0)')).toBe(true);
        expect(isValidColor('rgba(0,0,0,0.5)')).toBe(true);
    });

    test('isValidColor rejects invalid inputs', () => {
        expect(isValidColor('123456')).toBe(false);
        expect(isValidColor('#ggg')).toBe(false);
        expect(isValidColor('rgb(999,0,0)')).toBe(false);
        expect(isValidColor('not-a-color')).toBe(false);
    });
});

describe('utils - extra cases', () => {

    test('normalizeColor returns null for invalid color', () => {
        expect(normalizeColor('invalid-color')).toBe(null);
    });

    test('rgbToHex handles invalid input gracefully', () => {
        expect(rgbToHex('not-a-color')).toBe('not-a-color');
    });

    test('isValidColor detects rgb with spaces', () => {
        expect(isValidColor('rgb( 255 , 0 , 0 )')).toBe(true);
    });

    test('isValidColor rejects empty string', () => {
        expect(isValidColor('')).toBe(false);
    });

    test('isValidColor rejects null and undefined', () => {
        expect(isValidColor(null)).toBe(false);
        expect(isValidColor(undefined)).toBe(false);
    });

});
