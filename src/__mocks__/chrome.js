// __mocks__/chrome.js
global.chrome = {
    tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1 }]),
    },
    scripting: {
        executeScript: jest.fn().mockResolvedValue([{ result: "#ff0000" }]),
    }
};
