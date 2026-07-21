/**
 * LibraVault — Issue & Return Workflow
 */

// ─── State ─────────────────────────────────────────────────
let issueState = { student: null, book: null, lastIssueId: null };
let returnState = { student: null, issue: null, lastIssueId: null };
let currentReservationsData = [];

// ═══════════════════════════════════════════════════════════
// ISSUE WORKFLOW
// ═══════════════════════════════════════════════════════════

async function searchStudentForIssue() {
    const rollNo = document.getElementById('issueStudentSearch').value.trim();
    if (!rollNo) { showToast('Enter a roll number', 'warning'); return; }

    try {
        const student = await apiFetch(`/api/members/search-roll?roll_no=${encodeURIComponent(rollNo)}`);
        issueState.student = student;

        const result = document.getElementById('issueStudentResult');
        result.innerHTML = `
            <div class="sr-name">${student.name}</div>
            <div class="sr-meta">${student.roll_no} • ${student.department} • ${student.username}</div>
        `;
        result.style.display = 'block';

        // Show step 2
        document.getElementById('issueStep2').style.display = 'block';
        setupBookSearch();
    } catch (err) {
        document.getElementById('issueStudentResult').style.display = 'none';
    }
}

function setupBookSearch() {
    const input = document.getElementById('issueBookSearch');
    input.addEventListener('input', debounce(async () => {
        const q = input.value.trim();
        if (!q) { document.getElementById('issueBookResults').innerHTML = ''; return; }

        try {
            const books = await apiFetch(`/api/books?q=${encodeURIComponent(q)}`);
            const results = document.getElementById('issueBookResults');
            results.innerHTML = books.map(b => {
                const avail = b.available_copies > 0;
                return `
                <div class="book-result-item ${avail ? '' : 'unavailable'}"
                     onclick="${avail ? `selectBookForIssue(${b.book_id}, '${b.title.replace(/'/g, "\\'")}', '${b.author.replace(/'/g, "\\'")}', ${b.available_copies})` : ''}">
                    <div>
                        <strong>${b.title}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${b.author}</div>
                    </div>
                    <span class="availability-badge ${avail ? 'avail-high' : 'avail-none'}">
                        ${avail ? b.available_copies + ' avail' : 'Unavailable'}
                    </span>
                </div>`;
            }).join('');
        } catch (err) {
            // handled
        }
    }, 300));
}

function selectBookForIssue(bookId, title, author, available) {
    issueState.book = { book_id: bookId, title, author, available };

    // Show step 3
    document.getElementById('issueStep2').querySelector('.book-results').innerHTML = '';
    document.getElementById('issueStep3').style.display = 'block';

    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 14);

    document.getElementById('issueConfirmCard').innerHTML = `
        <div class="confirm-row"><span class="label">Student</span><span class="value">${issueState.student.name} (${issueState.student.roll_no})</span></div>
        <div class="confirm-row"><span class="label">Book</span><span class="value">${title}</span></div>
        <div class="confirm-row"><span class="label">Author</span><span class="value">${author}</span></div>
        <div class="confirm-row"><span class="label">Issue Date</span><span class="value">${today.toLocaleDateString('en-IN')}</span></div>
        <div class="confirm-row"><span class="label">Due Date</span><span class="value">${due.toLocaleDateString('en-IN')}</span></div>
        <div class="confirm-row"><span class="label">Available Copies</span><span class="value">${available}</span></div>
    `;
}

async function confirmIssue() {
    if (!issueState.student || !issueState.book) return;

    const btn = document.getElementById('confirmIssueBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const result = await apiFetch('/api/issues/issue', {
            method: 'POST',
            body: JSON.stringify({
                book_id: issueState.book.book_id,
                member_id: issueState.student.member_id
            })
        });

        // Store issue_id for receipt
        issueState.lastIssueId = result.issue_id;

        // Show success
        document.getElementById('issueStep1').style.display = 'none';
        document.getElementById('issueStep2').style.display = 'none';
        document.getElementById('issueStep3').style.display = 'none';
        document.getElementById('issueSuccessMsg').textContent = result.message;
        document.getElementById('issueSuccess').style.display = 'block';
        showToast(result.message, 'success');
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Confirm Issue';
    }
}

function resetIssue() {
    issueState = { student: null, book: null, lastIssueId: null };
    document.getElementById('issueStudentSearch').value = '';
    document.getElementById('issueStudentResult').style.display = 'none';
    document.getElementById('issueStep2').style.display = 'none';
    document.getElementById('issueStep3').style.display = 'none';
    document.getElementById('issueSuccess').style.display = 'none';
    document.getElementById('issueStep1').style.display = 'block';
    const btn = document.getElementById('confirmIssueBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm Issue'; }
    if (document.getElementById('issueBookSearch')) document.getElementById('issueBookSearch').value = '';
    if (document.getElementById('issueBookResults')) document.getElementById('issueBookResults').innerHTML = '';
}


// ═══════════════════════════════════════════════════════════
// RETURN WORKFLOW
// ═══════════════════════════════════════════════════════════

async function searchStudentForReturn() {
    const rollNo = document.getElementById('returnStudentSearch').value.trim();
    if (!rollNo) { showToast('Enter a roll number', 'warning'); return; }

    try {
        const student = await apiFetch(`/api/members/search-roll?roll_no=${encodeURIComponent(rollNo)}`);
        returnState.student = student;

        const result = document.getElementById('returnStudentResult');
        result.innerHTML = `
            <div class="sr-name">${student.name}</div>
            <div class="sr-meta">${student.roll_no} • ${student.department}</div>
        `;
        result.style.display = 'block';

        // Load issued books for this student
        await loadReturnBooks(student.member_id);
    } catch (err) {
        document.getElementById('returnStudentResult').style.display = 'none';
    }
}

async function loadReturnBooks(memberId) {
    try {
        const issues = await apiFetch(`/api/issues/issued?member_id=${memberId}`);
        const list = document.getElementById('returnBooksList');

        if (issues.length === 0) {
            list.innerHTML = '<div class="text-center text-muted p-3">No books currently issued</div>';
            document.getElementById('returnStep2').style.display = 'block';
            return;
        }

        list.innerHTML = issues.map(issue => {
            const overdue = issue.is_overdue;
            return `
            <div class="issued-book-item ${overdue ? 'overdue' : ''}" onclick="selectBookForReturn(${issue.issue_id}, '${issue.title.replace(/'/g, "\\'")}', '${issue.due_date}', ${overdue}, ${issue.estimated_fine || 0})">
                <div class="ib-title">${issue.title}</div>
                <div class="ib-meta">
                    <span><i class="fas fa-calendar-plus"></i> Issued: ${issue.issue_date}</span>
                    <span><i class="fas fa-calendar-times"></i> Due: ${issue.due_date}</span>
                    ${overdue ? `<span class="ib-overdue"><i class="fas fa-exclamation-triangle"></i> ${issue.days_late} days late • ₹${issue.estimated_fine}</span>` : `<span><i class="fas fa-clock"></i> ${issue.days_remaining} days left</span>`}
                </div>
            </div>`;
        }).join('');

        document.getElementById('returnStep2').style.display = 'block';
    } catch (err) {
        // handled
    }
}

function selectBookForReturn(issueId, title, dueDate, isOverdue, estimatedFine) {
    returnState.issue = { issue_id: issueId, title, dueDate, isOverdue, estimatedFine };

    document.getElementById('returnStep3').style.display = 'block';
    document.getElementById('returnConfirmCard').innerHTML = `
        <div class="confirm-row"><span class="label">Student</span><span class="value">${returnState.student.name}</span></div>
        <div class="confirm-row"><span class="label">Book</span><span class="value">${title}</span></div>
        <div class="confirm-row"><span class="label">Due Date</span><span class="value">${dueDate}</span></div>
        <div class="confirm-row"><span class="label">Return Date</span><span class="value">${new Date().toLocaleDateString('en-IN')}</span></div>
        ${isOverdue ? `<div class="confirm-row"><span class="label" style="color: var(--warning);">Estimated Fine</span><span class="value" style="color: var(--warning);">₹${estimatedFine.toFixed(2)}</span></div>` : '<div class="confirm-row"><span class="label" style="color: var(--success);">Fine</span><span class="value" style="color: var(--success);">None</span></div>'}
    `;
}

async function confirmReturn() {
    if (!returnState.issue) return;

    const btn = document.getElementById('confirmReturnBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const result = await apiFetch('/api/issues/return', {
            method: 'POST',
            body: JSON.stringify({ issue_id: returnState.issue.issue_id })
        });

        // Store issue_id for receipt
        returnState.lastIssueId = returnState.issue.issue_id;

        // Show success
        document.getElementById('returnStep1').style.display = 'none';
        document.getElementById('returnStep2').style.display = 'none';
        document.getElementById('returnStep3').style.display = 'none';
        document.getElementById('returnSuccessMsg').textContent = result.message;

        if (result.fine_amount > 0) {
            document.getElementById('returnFineDisplay').style.display = 'block';
            document.getElementById('returnFineDisplay').innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Late fine: ₹${result.fine_amount.toFixed(2)}
            `;
        } else {
            document.getElementById('returnFineDisplay').style.display = 'none';
        }

        document.getElementById('returnSuccess').style.display = 'block';
        showToast(result.message, 'success');
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Confirm Return';
    }
}

function resetReturn() {
    returnState = { student: null, issue: null, lastIssueId: null };
    document.getElementById('returnStudentSearch').value = '';
    document.getElementById('returnStudentResult').style.display = 'none';
    document.getElementById('returnStep2').style.display = 'none';
    document.getElementById('returnStep3').style.display = 'none';
    document.getElementById('returnSuccess').style.display = 'none';
    document.getElementById('returnStep1').style.display = 'block';
    const btn = document.getElementById('confirmReturnBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirm Return'; }
}

// ─── Enter key support ────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    const issueInput = document.getElementById('issueStudentSearch');
    if (issueInput) {
        issueInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchStudentForIssue();
        });
    }
    const returnInput = document.getElementById('returnStudentSearch');
    if (returnInput) {
        returnInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchStudentForReturn();
        });
    }
    
    // Load admin reservations if the table exists
    if (document.getElementById('adminReservationsBody')) {
        loadAdminReservations();
    }
});

// ─── Admin Reservations ───────────────────────────────────

async function loadAdminReservations() {
    try {
        const res = await apiFetch('/api/issues/reservations');
        currentReservationsData = res;
        const tbody = document.getElementById('adminReservationsBody');
        
        if (res.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No pending reservations</td></tr>';
            return;
        }

        tbody.innerHTML = res.map(r => `
            <tr>
                <td>#${r.issue_id}</td>
                <td>
                    <strong>${r.book_title}</strong><br>
                    <small class="text-muted">${r.isbn || 'N/A'}</small>
                </td>
                <td>${r.member_name}</td>
                <td>${r.roll_no}</td>
                <td>${r.issue_date}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="fulfillReservation(${r.issue_id})" title="Hand over the book">
                        <i class="fas fa-check"></i> Hand Over
                    </button>
                    <button class="btn btn-sm btn-danger ms-2" onclick="adminCancelReservation(${r.issue_id})" title="Cancel reservation">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
        document.getElementById('adminReservationsBody').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load</td></tr>';
    }
}

async function fulfillReservation(issueId) {
    if (!await customConfirm('Hand over this book to the student?')) return;
    try {
        const res = await fetch(`/api/issues/reservations/${issueId}/fulfill`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadAdminReservations();
        } else {
            showToast(data.error || 'Failed to fulfill', 'error');
        }
    } catch (err) {
        showToast('Error', 'error');
    }
}

async function adminCancelReservation(issueId) {
    if (!await customConfirm('Are you sure you want to cancel this reservation? The copy will be returned to stock.')) return;
    try {
        const res = await fetch(`/api/issues/reservations/${issueId}/cancel`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            loadAdminReservations();
        } else {
            showToast(data.error || 'Failed to cancel', 'error');
        }
    } catch (err) {
        showToast('Error', 'error');
    }
}

function exportReservationsPDF() {
    if (!currentReservationsData || !currentReservationsData.length) {
        showToast('No reservations to export', 'warning');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Pending Reservations', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    const rows = currentReservationsData.map(r => [
        r.issue_id,
        r.book_title,
        r.isbn || '—',
        r.member_name,
        r.roll_no,
        r.issue_date
    ]);
    
    doc.autoTable({
        head: [['ID', 'Book', 'ISBN', 'Student', 'Roll No', 'Reserved On']],
        body: rows,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [108, 92, 231] }
    });
    
    doc.save('pending_reservations.pdf');
    showToast('PDF exported successfully!', 'success');
}

// ─── Receipt Openers (used by issue/return success buttons) ──

function openIssueReceipt() {
    if (issueState.lastIssueId && typeof openReceiptModal === 'function') {
        openReceiptModal(issueState.lastIssueId);
    } else {
        showToast('Receipt not available', 'warning');
    }
}

function openReturnReceipt() {
    if (returnState.lastIssueId && typeof openReceiptModal === 'function') {
        openReceiptModal(returnState.lastIssueId);
    } else {
        showToast('Receipt not available', 'warning');
    }
}
