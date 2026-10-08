const POOL_BUTTON_COMMANDS = new Map([
    ['poolcard:bet', '.poolcard bet'],
    ['poolcard:shoot', '.poolcard shoot'],
    ['poolcard:reset', '.poolcard reset'],
]);

const normalizePoolcardButton = value => {
    const text = String(value || '').trim();
    if (!text) return null;
    return POOL_BUTTON_COMMANDS.get(text.toLowerCase()) || null;
};

const parseJson = value => {
    if (!value) return null;
    if (Buffer.isBuffer(value)) value = value.toString('utf8');
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
};

const extractPoolcardButtonValues = message => {
    const values = [];
    const add = value => {
        if (value !== undefined && value !== null && String(value).trim()) values.push(String(value).trim());
    };
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        add(node.conversation);
        add(node.text);
        add(node.contentText);
        add(node.selectedButtonId);
        add(node.selectedDisplayText);
        add(node.selectedId);
        add(node.title);
        add(node.buttonId);
        add(node.id);
        add(node.displayText);
        add(node.singleSelectReply?.selectedRowId);
        add(node.singleSelectReply?.selectedDisplayText);
        add(node.nativeFlowResponseMessage?.name);
        add(node.nativeFlowResponseMessage?.buttonParamsJson);
        add(node.interactiveResponseMessage?.body?.text);
        add(node.interactiveResponseMessage?.nativeFlowResponseMessage?.name);
        add(node.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonParamsJson);

        for (const candidate of [
            node.buttonParamsJson,
            node.nativeFlowResponseMessage?.buttonParamsJson,
            node.interactiveResponseMessage?.nativeFlowResponseMessage?.buttonParamsJson
        ]) {
            const parsed = parseJson(candidate);
            if (parsed) {
                add(parsed.id);
                add(parsed.button_id);
                add(parsed.buttonId);
                add(parsed.selected_id);
                add(parsed.display_text);
                add(parsed.text);
                visit(parsed);
            }
        }

        for (const [key, child] of Object.entries(node)) {
            if (key === 'contextInfo' || key === 'messageContextInfo') continue;
            if (child && typeof child === 'object') visit(child);
        }
    };
    visit(message);
    return [...new Set(values)];
};

const normalizePoolcardButtonMessage = message => {
    for (const value of extractPoolcardButtonValues(message)) {
        const command = normalizePoolcardButton(value);
        if (command) return command;
    }
    return null;
};

module.exports = {
    normalizePoolcardButton,
    normalizePoolcardButtonMessage,
    extractPoolcardButtonValues,
    POOL_BUTTON_COMMANDS
};
