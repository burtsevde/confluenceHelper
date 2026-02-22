// __mocks__/chrome.js
import { jest } from '@jest/globals';

export const chromeMock = {
    tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1 }]),
    },
    scripting: {
        executeScript: jest.fn().mockImplementation(() => Promise.resolve([{ result: "#ff0000" }])),
    }
};

global.chrome = chromeMock;
