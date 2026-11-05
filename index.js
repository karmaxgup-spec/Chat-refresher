import { getContext } from '../../../st-context.js';
import { isGenerating } from '../../../../script.js';

/**
 * Live "# Messages to Load" (chat_truncation) apply.
 *
 * Core behaviour: changing the "# Messages to Load" value only saves the
 * setting. The messages already on screen are not re-rendered, so the new
 * limit only applies after a page refresh. This extension watches the slider
 * and the number box, then re-renders the visible chat in place (no server
 * fetch, no page reload) once the value settles.
 */

const SLIDER_ID = '#chat_truncation';
const COUNTER_ID = '#chat_truncation_counter';
const DEBOUNCE_MS = 400;

let appliedValue = null;
let debounceTimer = null;

function currentValue() {
    const raw = $(SLIDER_ID).val() ?? $(COUNTER_ID).val();
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

function hasActiveChat() {
    const ctx = getContext();
    if (!Array.isArray(ctx.chat) || ctx.chat.length === 0) {
        return false;
    }
    return ctx.groupId !== undefined || ctx.characterId !== undefined;
}

async function rerenderVisibleChat() {
    // Don't touch the DOM while a reply is being generated; retry shortly after.
    if (isGenerating()) {
        scheduleApply();
        return;
    }

    if (!hasActiveChat()) {
        return;
    }

    const value = currentValue();
    if (value === null || value === appliedValue) {
        return;
    }

    // Remove only the message elements and the "Show more" button; keep the rest of #chat.
    $('#chat .mes, #show_more_messages').remove();

    await getContext().printMessages();
    appliedValue = value;
    console.debug(`[chat-render-live] re-rendered chat with ${value} messages`);
}

function scheduleApply() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rerenderVisibleChat, DEBOUNCE_MS);
}

function init() {
    appliedValue = currentValue();

    // Slider drag and number typing both trigger input events.
    $(SLIDER_ID).on('input change', scheduleApply);
    $(COUNTER_ID).on('input change', scheduleApply);

    // Re-read the baseline when a different chat/character is opened, so a
    // stale value never blocks the next real change.
    const ctx = getContext();
    ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
        appliedValue = currentValue();
    });

    console.log('[chat-render-live] loaded');
}

// The settings panel is part of the page's initial HTML, so this is safe to run now.
init();
