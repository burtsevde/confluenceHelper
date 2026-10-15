// Chrome serializes each function passed to executeScript. Keep their helpers local.
function readSelectedColor() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed && selection.toString().trim()) {
        const range = selection.getRangeAt(0);
        const start = range.startContainer;
        const node = start.nodeType === Node.TEXT_NODE
            ? start.parentElement
            : start.childNodes[range.startOffset] || start;
        const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (element) return window.getComputedStyle(element).color;
    }

    const input = document.activeElement;
    if (input && (input.tagName === "INPUT" || input.tagName === "TEXTAREA") &&
        input.selectionStart !== input.selectionEnd) {
        return window.getComputedStyle(input).color;
    }
    return null;
}

function findMatchesByColor(searchColor) {
    if (!document.body) return { matches: [], totalCount: 0 };
    document.querySelectorAll(".color-text-finder-highlight").forEach(element => {
        element.style.backgroundColor = "";
        element.style.outline = "";
        element.classList.remove("color-text-finder-highlight");
    });

    const limit = 150;
    const matches = [];
    const matchedElements = new Map();
    const checkedColors = new Map();
    const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "TEMPLATE"]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    function matchesColor(element) {
        if (!checkedColors.has(element)) {
            const color = window.getComputedStyle(element).color;
            const channels = color.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
            const hex = channels
                ? "#" + channels.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, "0")).join("")
                : color.toLowerCase();
            checkedColors.set(element, hex === searchColor || color.toLowerCase() === searchColor);
        }
        return checkedColors.get(element);
    }

    while (walker.nextNode()) {
        const textNode = walker.currentNode;
        const text = textNode.textContent.trim();
        const element = textNode.parentElement;
        if (!text || !element || ignoredTags.has(element.tagName) ||
            element.closest("script, style, noscript, textarea, template") || !matchesColor(element)) continue;

        if (!matchedElements.has(element)) matchedElements.set(element, []);
        matchedElements.get(element).push(text);
    }

    let totalCount = 0;
    for (const [element, parts] of matchedElements) {
        totalCount++;
        if (matches.length >= limit) continue;
        matches.push(parts.join(" "));
        element.classList.add("color-text-finder-highlight");
        element.style.backgroundColor = "yellow";
        element.style.outline = "2px solid blue";
    }

    return { matches, totalCount };
}

function focusHighlightedMatch(index) {
    const highlighted = document.querySelectorAll(".color-text-finder-highlight");
    if (!highlighted[index]) return;
    highlighted[index].scrollIntoView({ behavior: "smooth", block: "center" });
    highlighted[index].style.transition = "background-color 0.5s";
    highlighted[index].style.backgroundColor = "orange";
    setTimeout(() => {
        highlighted[index].style.backgroundColor = "yellow";
    }, 1500);
}

function expandButtons() {
    const elements = document.querySelectorAll('[id*="expand-button"]');
    elements.forEach(element => element.click());
    return elements.length;
}

window.ConfluencePageActions = {
    readSelectedColor,
    findMatchesByColor,
    focusHighlightedMatch,
    expandButtons,
};
