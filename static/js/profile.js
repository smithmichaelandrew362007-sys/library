document.addEventListener('DOMContentLoaded', loadProfile);

async function loadProfile() {
    try {
        const data = await apiFetch('/api/profile/stats');
        renderStats(data.stats);
        renderMessages(data.messages);
    } catch (err) {
        console.error('Failed to load profile:', err);
    }
}

function renderStats(stats) {
    document.getElementById('monthReads').textContent = stats.month_reads;
    document.getElementById('yearReads').textContent = stats.year_reads;
    document.getElementById('overallReads').textContent = stats.overall_reads;
    document.getElementById('totalDues').textContent = '₹' + stats.total_dues.toFixed(2);
}

function renderMessages(messages) {
    const list = document.getElementById('messagesList');
    if (!messages || messages.length === 0) {
        list.innerHTML = '<div class="text-center text-muted p-4">You have no messages.</div>';
        return;
    }
    
    list.innerHTML = messages.map(m => `
        <div class="card mb-2 ${m.is_read ? 'bg-light' : ''}" style="border-left: 4px solid ${m.is_read ? '#ccc' : 'var(--accent-primary)'}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="card-title mb-0">From: ${m.sender_name}</h6>
                    <small class="text-muted">${m.sent_at}</small>
                </div>
                <p class="card-text">${m.message}</p>
                ${!m.is_read ? `<button class="btn btn-sm btn-outline-primary" onclick="markRead(${m.message_id})">Mark as Read</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function markRead(messageId) {
    try {
        const res = await apiFetch(`/api/messages/${messageId}/read`, { method: 'POST' });
        if (res.success) {
            loadProfile(); // refresh
        }
    } catch (err) {
        console.error('Failed to mark read:', err);
    }
}
