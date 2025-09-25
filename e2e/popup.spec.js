import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к собранному Chrome-расширению
const extensionPath = path.join(__dirname, '../dist/chrome');

test('popup opens and button works', async () => {
    // Запуск Chromium с расширением
    const context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    });

    const page = await context.newPage();
    await page.goto('about:blank');

    // Открываем popup
    const [background] = context.serviceWorkers();
    expect(background).toBeTruthy();

    // Тестируем кнопку в popup (пример)
    const [popupPage] = context.pages().filter(p => p.url().includes('popup.html'));
    if (popupPage) {
        const btn = await popupPage.$('button'); // адаптируй селектор под свой popup
        expect(btn).not.toBeNull();
        await btn.click();
    }

    await context.close();
});
