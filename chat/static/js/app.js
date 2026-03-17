// ========================================
// ProtoSem Chat — Frontend Logic
// ========================================

const chatArea = document.getElementById('chatArea');
const welcomeMessage = document.getElementById('welcomeMessage');
const queryInput = document.getElementById('queryInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const imageInput = document.getElementById('imageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

let currentImageDataURI = null;
let isStreaming = false;

// ========== Auto-resize textarea ==========
queryInput.addEventListener('input', () => {
    queryInput.style.height = 'auto';
    queryInput.style.height = Math.min(queryInput.scrollHeight, 140) + 'px';
});

// ========== Image handling ==========
attachBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        currentImageDataURI = ev.target.result;
        imagePreview.src = currentImageDataURI;
        imagePreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
});

removeImageBtn.addEventListener('click', () => {
    currentImageDataURI = null;
    imageInput.value = '';
    imagePreviewContainer.style.display = 'none';
});

// ========== Send message ==========
sendBtn.addEventListener('click', sendMessage);

queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const query = queryInput.value.trim();
    if (!query || isStreaming) return;

    // Hide welcome
    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }

    // Add user message
    addUserMessage(query, currentImageDataURI);

    // Clear input
    queryInput.value = '';
    queryInput.style.height = 'auto';
    const imageToSend = currentImageDataURI;
    currentImageDataURI = null;
    imageInput.value = '';
    imagePreviewContainer.style.display = 'none';

    // Start streaming
    streamResponse(query, imageToSend);
}

// ========== Add user message to DOM ==========
function addUserMessage(text, imageDataURI) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user';

    let imageHtml = '';
    if (imageDataURI) {
        imageHtml = `<img class="user-image" src="${imageDataURI}" alt="User uploaded image">`;
    }

    msgDiv.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">
                ${imageHtml}
                <div>${escapeHtml(text)}</div>
            </div>
        </div>
        <div class="message-avatar">U</div>
    `;

    chatArea.appendChild(msgDiv);
    scrollToBottom();
}

// ========== Create assistant message skeleton ==========
function createAssistantMessage() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';

    msgDiv.innerHTML = `
        <div class="message-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="response-content"></div>
            </div>
        </div>
    `;

    chatArea.appendChild(msgDiv);
    scrollToBottom();

    return {
        element: msgDiv,
        contentEl: msgDiv.querySelector('.response-content'),
        bubble: msgDiv.querySelector('.message-bubble'),
    };
}

// ========== Stream response ==========
async function streamResponse(query, imageDataURI) {
    isStreaming = true;
    sendBtn.disabled = true;

    const assistant = createAssistantMessage();

    // Show loading dots
    assistant.contentEl.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;

    const payload = { query };
    if (imageDataURI) {
        payload.image = imageDataURI;
    }

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullText = '';
        let buffer = '';
        let thinkContent = '';
        let mainContent = '';
        let inThink = false;
        let thinkDone = false;
        let thinkBlockEl = null;
        let thinkContentEl = null;
        let mainContentEl = null;
        let firstToken = true;

        // Clear loading
        assistant.contentEl.innerHTML = '';

        let hasError = false;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process SSE lines
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line in buffer

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    continue;
                }

                if (parsed.error) {
                    assistant.contentEl.innerHTML = `<span style="color: #ef4444;">Error: ${escapeHtml(parsed.error)}</span>`;
                    hasError = true;
                    break;
                }

                const token = parsed.token || '';
                if (!token) continue;

                fullText += token;

                // Parse think tags from the full accumulated text
                renderStreamedContent(fullText, assistant.contentEl);
                scrollToBottom();
            }
        }

        // Final render — make sure everything is clean, unless we hit an error
        if (!hasError) {
            renderStreamedContent(fullText, assistant.contentEl, true);

            // Collapse think block if it exists and has content
            const thinkBlock = assistant.contentEl.querySelector('.think-block');
            if (thinkBlock) {
                thinkBlock.classList.add('collapsed');
            }
        }

    } catch (err) {
        assistant.contentEl.innerHTML = `<span style="color: #ef4444;">Error: ${escapeHtml(err.message)}</span>`;
    }

    isStreaming = false;
    sendBtn.disabled = false;
    queryInput.focus();
    scrollToBottom();
}

// ========== Render streamed content with think parsing ==========
function renderStreamedContent(fullText, containerEl, isFinal = false) {
    let html = '';

    // Check for <think> tags
    const thinkOpenIdx = fullText.indexOf('<think>');

    if (thinkOpenIdx === -1) {
        // No think tag at all — just render as main content
        html = `<div class="main-content ${isFinal ? '' : 'streaming-cursor'}">${formatText(fullText)}</div>`;
        containerEl.innerHTML = html;
        return;
    }

    // There is a <think> tag
    const afterThinkOpen = fullText.substring(thinkOpenIdx + 7); // after <think>
    const thinkCloseIdx = afterThinkOpen.indexOf('</think>');

    if (thinkCloseIdx === -1) {
        // Still inside thinking — haven't seen </think> yet
        const thinkText = afterThinkOpen;

        // Don't show the widget yet if there is no actual content between tags
        if (thinkText.trim().length === 0 && !isFinal) {
            containerEl.innerHTML = `<div class="main-content streaming-cursor"></div>`;
            return;
        }

        html = `
            <div class="think-block">
                <div class="think-header">
                    <div class="think-header-left">
                        <span class="think-icon">💭</span>
                        <span class="think-label">Thinking</span>
                    </div>
                    <span class="think-toggle">▼</span>
                </div>
                <div class="think-content streaming-cursor">${formatText(thinkText)}</div>
            </div>
        `;
        containerEl.innerHTML = html;
    } else {
        // Think block is complete
        const thinkText = afterThinkOpen.substring(0, thinkCloseIdx);
        const mainText = afterThinkOpen.substring(thinkCloseIdx + 8).trim(); // after </think>

        if (thinkText.trim().length === 0) {
            // Empty think block — don't show it at all
            if (mainText.length > 0 || !isFinal) {
                html = `<div class="main-content ${isFinal ? '' : 'streaming-cursor'}">${formatText(mainText)}</div>`;
            }
        } else {
            // Think block has content
            const collapseClass = isFinal ? 'collapsed' : '';
            html = `
                <div class="think-block ${collapseClass}">
                    <div class="think-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div class="think-header-left">
                            <span class="think-icon">💭</span>
                            <span class="think-label">${isFinal ? 'Thought Process' : 'Thinking'}</span>
                        </div>
                        <span class="think-toggle">▼</span>
                    </div>
                    <div class="think-content">${formatText(thinkText)}</div>
                </div>
            `;
            if (mainText.length > 0 || !isFinal) {
                html += `<div class="main-content ${isFinal ? '' : 'streaming-cursor'}">${formatText(mainText)}</div>`;
            }
        }

        containerEl.innerHTML = html;
    }
}

// ========== Text formatting ==========
function formatText(text) {
    // Escape HTML first
    let escaped = escapeHtml(text);

    // Code blocks (```...```)
    escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Line breaks
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== Scroll ==========
function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
}
