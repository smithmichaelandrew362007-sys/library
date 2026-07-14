/**
 * LibraVault — Dashboard Charts & Stats
 */

document.addEventListener('DOMContentLoaded', loadDashboard);

async function loadDashboard() {
    try {
        const stats = await apiFetch('/api/dashboard/stats');
        renderStats(stats);
        renderMonthlyChart(stats.monthly_stats);
        renderCategoryChart(stats.category_stats);
        renderActivity(stats.recent_activity);
        renderRecentMembers(stats.recent_members);
        renderQuickStats(stats);
        loadMostBorrowed();
        loadReservations();
    } catch (err) {
        console.error('Dashboard load failed:', err);
    }
}

function renderStats(stats) {
    animateCounter('totalBooks', stats.total_books);
    animateCounter('totalMembers', stats.total_members);
    animateCounter('issuedToday', stats.issued_today);
    animateCounter('overdueCount', stats.overdue_count);
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;

    const duration = 800;
    const start = performance.now();
    const initial = 0;

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(initial + (target - initial) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

function renderMonthlyChart(monthlyStats) {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = monthlyStats.map(s => {
        const parts = s.month.split('-');
        return months[parseInt(parts[1]) - 1] + ' ' + parts[0].slice(2);
    });
    const data = monthlyStats.map(s => s.count);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Books Issued',
                data: data.length ? data : [0],
                backgroundColor: 'rgba(108, 92, 231, 0.6)',
                borderColor: 'rgba(108, 92, 231, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: 'rgba(108, 92, 231, 0.3)',
                    borderWidth: 1,
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 8,
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b', font: { family: 'Inter' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b', font: { family: 'Inter' }, stepSize: 1 },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderCategoryChart(categoryStats) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const colors = ['#6c5ce7', '#a855f7', '#6366f1', '#00b894', '#fdcb6e', '#e17055', '#74b9ff', '#fab1a0'];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categoryStats.map(c => c.category),
            datasets: [{
                data: categoryStats.map(c => c.count),
                backgroundColor: colors.slice(0, categoryStats.length),
                borderColor: 'rgba(10, 14, 23, 0.8)',
                borderWidth: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    borderColor: 'rgba(108, 92, 231, 0.3)',
                    borderWidth: 1,
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 8,
                }
            }
        }
    });
}

function renderActivity(activity) {
    const list = document.getElementById('activityList');
    if (!list) return;

    if (!activity.length) {
        list.innerHTML = '<div class="text-center text-muted p-3">No recent activity</div>';
        return;
    }

    list.innerHTML = activity.map(a => {
        const isReturn = a.status === 'returned';
        return `
        <div class="activity-item">
            <div class="activity-icon ${isReturn ? 'returned' : 'issued'}">
                <i class="fas fa-${isReturn ? 'arrow-left' : 'arrow-right'}"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${a.title}</div>
                <div class="activity-meta">
                    ${isReturn ? 'Returned by' : 'Issued to'} ${a.member_name} (${a.roll_no})
                    • ${a.issue_date}
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderQuickStats(stats) {
    document.getElementById('totalCopies').textContent = stats.total_copies;
    document.getElementById('currentlyIssued').textContent = stats.currently_issued;
    document.getElementById('unpaidFines').textContent = `₹${stats.total_unpaid_fines.toFixed(2)}`;
}

function renderRecentMembers(members) {
    const list = document.getElementById('newMembersList');
    const row = document.getElementById('newMembersRow');
    if (!list || !row) return;

    if (!members || !members.length) {
        row.style.display = 'none';
        return;
    }

    row.style.display = 'block';

    list.innerHTML = members.map(m => `
    <div class="activity-item" style="padding: 12px 16px;">
        <div class="activity-icon" style="background: rgba(108, 92, 231, 0.15); color: var(--accent-primary);">
            <i class="fas fa-user-check"></i>
        </div>
        <div class="activity-details">
            <div class="activity-title">New Student Registered: ${m.name}</div>
            <div class="activity-meta">
                Roll No: ${m.roll_no} • Joined on ${m.created_at}
            </div>
        </div>
    </div>`).join('');
}

async function loadMostBorrowed() {
    try {
        const books = await apiFetch('/api/books/most-borrowed?limit=5');
        const list = document.getElementById('mostBorrowedList');
        if (!list) return;

        if (!books.length) {
            list.innerHTML = '<div class="text-center text-muted p-2">No data yet</div>';
            return;
        }

        list.innerHTML = books.map((b, i) => `
            <div class="mb-item">
                <span>${i + 1}. ${b.title}</span>
                <span class="count">${b.borrow_count}×</span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load most borrowed:', err);
    }
}

async function loadReservations() {
    try {
        const res = await apiFetch('/api/issues/reservations');
        const list = document.getElementById('adminReservationsList');
        const row = document.getElementById('reservationsRow');
        if (!list || !row) return;

        if (!res || res.length === 0) {
            row.style.display = 'none';
            return;
        }

        row.style.display = 'block';
        
        // Reverse array to display oldest reservations first (in order of booking)
        res.reverse();

        list.innerHTML = res.map(r => `
        <div class="activity-item" style="justify-content: space-between; padding: 12px 16px;">
            <div style="display: flex; gap: 12px; align-items: center;">
                <div class="activity-icon" style="background: rgba(253, 203, 110, 0.15); color: var(--warning);">
                    <i class="fas fa-bookmark"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">${r.book_title} <span class="text-muted" style="font-size: 0.8em; font-weight: normal;">(ISBN: ${r.isbn})</span></div>
                    <div class="activity-meta" style="margin-top: 4px;">
                        Booked by <strong>${r.member_name}</strong> (${r.roll_no}) on ${r.issue_date}
                    </div>
                </div>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-success" onclick="fulfillReservation(${r.issue_id})">
                    <i class="fas fa-check"></i> Fulfill
                </button>
            </div>
        </div>`).join('');
    } catch (err) {
        console.error('Failed to load reservations:', err);
    }
}

async function fulfillReservation(issueId) {
    if (!await customConfirm('Mark this reservation as fulfilled (hand over the book)?')) return;
    try {
        const res = await apiFetch(`/api/issues/reservations/${issueId}/fulfill`, { method: 'POST' });
        if (res.success) {
            showToast('Reservation fulfilled successfully!', 'success');
            loadReservations();
            loadDashboard(); // Refresh other stats (like currently issued)
        } else {
            showToast(res.error || 'Failed to fulfill reservation', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error fulfilling reservation', 'error');
    }
}
