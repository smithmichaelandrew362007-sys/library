/**
 * LibraVault — Billing & Receipt System
 */

let currentTransactionsData = [];

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    loadBillingSummary();
    loadTransactions();
});


// ═══════════════════════════════════════════════════════════
// BILLING SUMMARY
// ═══════════════════════════════════════════════════════════

async function loadBillingSummary() {
    try {
        const data = await apiFetch('/api/billing/summary');

        document.getElementById('totalCollected').textContent = '₹' + data.total_fines_collected.toFixed(2);
        document.getElementById('totalUnpaid').textContent = '₹' + data.total_unpaid_fines.toFixed(2);
        document.getElementById('todayTransactions').textContent = data.transactions_today;
        document.getElementById('collectionRate').textContent = data.fine_collection_rate + '%';

        // Update fee structure info
        document.getElementById('ruleLoanDays').textContent = data.loan_days + ' days';
        document.getElementById('ruleFineRate').textContent = '₹' + data.fine_per_day + '/day';
        document.getElementById('ruleMaxFine').textContent = '₹' + data.max_fine;
    } catch (err) {
        console.error('Failed to load billing summary:', err);
    }
}


// ═══════════════════════════════════════════════════════════
// TRANSACTIONS TABLE
// ═══════════════════════════════════════════════════════════

async function loadTransactions() {
    const tbody = document.getElementById('billingBody');
    tbody.innerHTML = '<tr><td colspan="11" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

    const status = document.getElementById('filterStatus').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;

    let url = '/api/billing/transactions?status=' + encodeURIComponent(status);
    if (dateFrom) url += '&from=' + encodeURIComponent(dateFrom);
    if (dateTo) url += '&to=' + encodeURIComponent(dateTo);

    try {
        const data = await apiFetch(url);
        currentTransactionsData = data;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(function(r) {
            var fine = r.fine_amount ? r.fine_amount.toFixed(2) : '0.00';
            var daysLate = r.days_late || 0;
            var returnDate = r.return_date || '—';
            var statusBadge = getStatusBadge(r);
            var fineDisplay = '';

            if (parseFloat(fine) > 0) {
                if (r.fine_paid) {
                    fineDisplay = '<span style="color: var(--success);">₹' + fine + ' <i class="fas fa-check-circle"></i></span>';
                } else {
                    fineDisplay = '<span style="color: var(--warning);">₹' + fine + '</span>';
                }
            } else if (r.estimated_fine && r.estimated_fine > 0) {
                fineDisplay = '<span style="color: var(--danger);">~₹' + r.estimated_fine.toFixed(2) + '</span>';
            } else {
                fineDisplay = '<span class="text-muted">—</span>';
            }

            return '<tr>' +
                '<td>#' + r.issue_id + '</td>' +
                '<td><strong>' + r.title + '</strong><br><small class="text-muted">' + r.author + '</small></td>' +
                '<td>' + r.member_name + '</td>' +
                '<td>' + r.roll_no + '</td>' +
                '<td>' + r.issue_date + '</td>' +
                '<td>' + r.due_date + '</td>' +
                '<td>' + returnDate + '</td>' +
                '<td>' + (daysLate > 0 ? '<span style="color: var(--danger);">' + daysLate + '</span>' : '—') + '</td>' +
                '<td>' + fineDisplay + '</td>' +
                '<td>' + statusBadge + '</td>' +
                '<td><button class="btn btn-sm btn-outline-primary" onclick="openReceipt(' + r.issue_id + ')" title="View Receipt"><i class="fas fa-receipt"></i></button></td>' +
                '</tr>';
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-danger">Failed to load transactions</td></tr>';
    }
}

function getStatusBadge(record) {
    if (record.status === 'issued') {
        if (record.days_late > 0) {
            return '<span class="status-badge status-overdue">Overdue</span>';
        }
        return '<span class="status-badge status-issued">Issued</span>';
    } else if (record.status === 'returned') {
        if (record.fine_amount > 0 && !record.fine_paid) {
            return '<span class="status-badge status-fine-unpaid">Fine Unpaid</span>';
        } else if (record.fine_amount > 0 && record.fine_paid) {
            return '<span class="status-badge status-fine-paid">Fine Paid</span>';
        }
        return '<span class="status-badge status-returned">Returned</span>';
    } else if (record.status === 'reserved') {
        return '<span class="status-badge status-reserved">Reserved</span>';
    }
    return '<span class="status-badge">' + record.status + '</span>';
}


// ═══════════════════════════════════════════════════════════
// RECEIPT GENERATION
// ═══════════════════════════════════════════════════════════

async function openReceipt(issueId) {
    var modal = new bootstrap.Modal(document.getElementById('receiptModal'));
    var body = document.getElementById('receiptBody');
    body.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin fa-2x"></i><br>Loading receipt...</div>';
    modal.show();

    try {
        var data = await apiFetch('/api/billing/receipt/' + issueId);
        body.innerHTML = buildReceiptHTML(data);
    } catch (err) {
        body.innerHTML = '<div class="text-center text-danger p-4"><i class="fas fa-times-circle fa-2x"></i><br>Failed to load receipt</div>';
    }
}

function buildReceiptHTML(data) {
    var fineSection = '';
    if (data.status === 'returned' && data.fine_amount > 0) {
        fineSection = '' +
            '<div class="receipt-section">' +
            '  <div class="receipt-section-title"><i class="fas fa-calculator"></i> Fine Calculation</div>' +
            '  <div class="receipt-row"><span>Days Late</span><span>' + data.days_late + ' day' + (data.days_late !== 1 ? 's' : '') + '</span></div>' +
            '  <div class="receipt-row"><span>Rate</span><span>₹' + data.fine_per_day + '/day</span></div>' +
            '  <div class="receipt-row"><span>Calculated</span><span>₹' + (data.days_late * data.fine_per_day).toFixed(2) + '</span></div>' +
            (data.days_late * data.fine_per_day > data.max_fine ?
                '  <div class="receipt-row"><span>Max Fine Cap</span><span>₹' + data.max_fine + '</span></div>' : '') +
            '  <div class="receipt-row receipt-total"><span>Fine Amount</span><span>₹' + data.fine_amount.toFixed(2) + '</span></div>' +
            '  <div class="receipt-row"><span>Fine Status</span><span class="' + (data.fine_paid ? 'receipt-paid' : 'receipt-unpaid') + '">' +
                (data.fine_paid ? '<i class="fas fa-check-circle"></i> PAID' : '<i class="fas fa-clock"></i> UNPAID') + '</span></div>' +
            '</div>';
    } else if (data.status === 'returned') {
        fineSection = '' +
            '<div class="receipt-section">' +
            '  <div class="receipt-section-title"><i class="fas fa-calculator"></i> Fine Calculation</div>' +
            '  <div class="receipt-row receipt-total"><span>Fine Amount</span><span class="receipt-paid">₹0.00 — No Fine</span></div>' +
            '</div>';
    }

    var returnRow = '';
    if (data.return_date && data.status === 'returned') {
        returnRow = '<div class="receipt-row"><span>Return Date</span><span>' + data.return_date + '</span></div>';
    }

    return '' +
        '<div class="receipt-printable" id="receiptPrintable">' +
        '  <div class="receipt-header">' +
        '    <div class="receipt-logo"><i class="fas fa-university"></i></div>' +
        '    <h3 class="receipt-college">' + data.college_name + '</h3>' +
        '    <p class="receipt-system">' + data.system_name + ' — Library Management System</p>' +
        '    <div class="receipt-type-badge">' + data.receipt_type + '</div>' +
        '  </div>' +

        '  <div class="receipt-meta">' +
        '    <div class="receipt-row"><span>Receipt No</span><span><strong>#' + data.issue_id + '</strong></span></div>' +
        '    <div class="receipt-row"><span>Date</span><span>' + new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + '</span></div>' +
        '  </div>' +

        '  <div class="receipt-section">' +
        '    <div class="receipt-section-title"><i class="fas fa-user"></i> Student Details</div>' +
        '    <div class="receipt-row"><span>Name</span><span>' + data.member_name + '</span></div>' +
        '    <div class="receipt-row"><span>Roll No</span><span>' + data.roll_no + '</span></div>' +
        '    <div class="receipt-row"><span>Department</span><span>' + (data.department || '—') + '</span></div>' +
        '  </div>' +

        '  <div class="receipt-section">' +
        '    <div class="receipt-section-title"><i class="fas fa-book"></i> Book Details</div>' +
        '    <div class="receipt-row"><span>Title</span><span>' + data.title + '</span></div>' +
        '    <div class="receipt-row"><span>Author</span><span>' + data.author + '</span></div>' +
        '    <div class="receipt-row"><span>ISBN</span><span>' + (data.isbn || '—') + '</span></div>' +
        '  </div>' +

        '  <div class="receipt-section">' +
        '    <div class="receipt-section-title"><i class="fas fa-calendar-alt"></i> Date Details</div>' +
        '    <div class="receipt-row"><span>Issue Date</span><span>' + (data.issue_date || '—') + '</span></div>' +
        '    <div class="receipt-row"><span>Due Date</span><span>' + (data.due_date || '—') + '</span></div>' +
        returnRow +
        '    <div class="receipt-row"><span>Loan Period</span><span>' + data.loan_days + ' days</span></div>' +
        '  </div>' +

        fineSection +

        '  <div class="receipt-footer">' +
        '    <p>Thank You! Happy Reading! 📚</p>' +
        '    <small>This is a computer-generated receipt.</small>' +
        '  </div>' +
        '</div>';
}


function printReceipt() {
    var receiptContent = document.getElementById('receiptPrintable');
    if (!receiptContent) return;

    var printWindow = window.open('', '_blank', 'width=800,height=900');
    printWindow.document.write('<!DOCTYPE html><html><head><title>Receipt — LibraVault</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(getPrintStyles());
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(receiptContent.outerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
    };
}

function getPrintStyles() {
    return '' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: "Segoe UI", system-ui, sans-serif; background: #fff; color: #1a1a1a; padding: 20px; }' +
        '.receipt-printable { max-width: 500px; margin: 0 auto; border: 2px solid #333; border-radius: 8px; padding: 24px; }' +
        '.receipt-header { text-align: center; padding-bottom: 16px; border-bottom: 2px dashed #ccc; margin-bottom: 16px; }' +
        '.receipt-logo { font-size: 2.5rem; color: #6c5ce7; margin-bottom: 8px; }' +
        '.receipt-college { font-size: 1.1rem; font-weight: 700; margin-bottom: 4px; }' +
        '.receipt-system { font-size: 0.85rem; color: #666; margin-bottom: 12px; }' +
        '.receipt-type-badge { display: inline-block; padding: 6px 16px; background: #6c5ce7; color: #fff; border-radius: 20px; font-weight: 600; font-size: 0.85rem; letter-spacing: 0.5px; }' +
        '.receipt-meta { padding: 12px 0; border-bottom: 1px solid #eee; margin-bottom: 12px; }' +
        '.receipt-section { padding: 12px 0; border-bottom: 1px solid #eee; margin-bottom: 8px; }' +
        '.receipt-section-title { font-weight: 600; font-size: 0.85rem; color: #6c5ce7; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }' +
        '.receipt-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9rem; }' +
        '.receipt-row span:first-child { color: #666; }' +
        '.receipt-row span:last-child { font-weight: 500; text-align: right; max-width: 60%; }' +
        '.receipt-total { font-size: 1.05rem; font-weight: 700; padding: 8px 0; border-top: 1px solid #ddd; margin-top: 4px; }' +
        '.receipt-paid { color: #00b894; font-weight: 600; }' +
        '.receipt-unpaid { color: #e17055; font-weight: 600; }' +
        '.receipt-footer { text-align: center; padding-top: 16px; border-top: 2px dashed #ccc; margin-top: 16px; }' +
        '.receipt-footer p { font-size: 1rem; font-weight: 600; }' +
        '.receipt-footer small { color: #999; font-size: 0.75rem; }';
}


// ═══════════════════════════════════════════════════════════
// SHARED RECEIPT FUNCTION (called from issues.js too)
// ═══════════════════════════════════════════════════════════

// This function can be called from anywhere in the app
window.openReceiptModal = openReceipt;
window.buildReceiptHTML = buildReceiptHTML;
window.printReceipt = printReceipt;


// ═══════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════

function exportBillingPDF() {
    if (!currentTransactionsData || !currentTransactionsData.length) {
        showToast('No transactions to export', 'warning');
        return;
    }

    var jspdf = window.jspdf;
    var doc = new jspdf.jsPDF();

    doc.setFontSize(18);
    doc.text('Billing & Transactions Report', 14, 22);
    doc.setFontSize(10);
    doc.text('Generated: ' + new Date().toLocaleDateString('en-IN') + ' | LibraVault', 14, 30);

    // Summary
    var totalCollected = document.getElementById('totalCollected').textContent;
    var totalUnpaid = document.getElementById('totalUnpaid').textContent;
    doc.setFontSize(10);
    doc.text('Total Fines Collected: ' + totalCollected + '   |   Unpaid Fines: ' + totalUnpaid, 14, 38);

    var rows = currentTransactionsData.map(function(r) {
        var fine = r.fine_amount ? r.fine_amount.toFixed(2) : '0.00';
        var fineStatus = '';
        if (parseFloat(fine) > 0) {
            fineStatus = r.fine_paid ? 'Paid' : 'Unpaid';
        }
        return [
            r.issue_id,
            r.title.substring(0, 25),
            r.member_name,
            r.roll_no,
            r.issue_date,
            r.due_date || '',
            r.return_date || '',
            r.days_late || 0,
            fine > 0 ? 'Rs.' + fine : '',
            fineStatus || r.status
        ];
    });

    doc.autoTable({
        head: [['ID', 'Book', 'Student', 'Roll', 'Issued', 'Due', 'Returned', 'Late', 'Fine', 'Status']],
        body: rows,
        startY: 44,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [108, 92, 231] }
    });

    doc.save('billing_report.pdf');
    showToast('PDF exported successfully!', 'success');
}
