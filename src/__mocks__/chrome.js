// __mocks__/chrome.js
import { jest } from "@jest/globals";

global.chrome = {
    runtime: {
        getURL: jest.fn(path => `chrome-extension://test/${path}`),
    },
    tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1 }]),
        get: jest.fn(id => Promise.resolve({ id, title: "Задача Jira" })),
    },
    windows: {
        create: jest.fn().mockResolvedValue({ id: 10 }),
    },
    scripting: {
        executeScript: jest.fn().mockResolvedValue([{ result: [] }]),
    }
};
