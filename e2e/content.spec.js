// e2e/content.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname в ES-модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Абсолютный путь к файлу
const TEST_FILE = path.join(__dirname, '../test.html');
const TEST_URL = 'file://' + TEST_FILE;

test.describe('Content script tests', () => {

    test('select text and send ExtensionMessage', async ({ page }) => {
        await page.goto(TEST_URL);

        // Ждём header
        const header = await page.waitForSelector('header', { timeout: 5000 });

        // Выделяем текст безопасно
        await page.evaluate(() => {
            const header = document.querySelector('header');
            if (header) {
                const range = document.createRange();
                range.selectNodeContents(header);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });

        // Отправляем сообщение расширению (эмуляция)
        await page.evaluate(() => {
            window.postMessage({ type: 'EXTENSION_MESSAGE', payload: 'test' }, '*');
        });

        // Проверяем выделенный текст
        const selectedText = await page.evaluate(() => window.getSelection().toString());
        expect(selectedText).not.toBe('');
    });

});
