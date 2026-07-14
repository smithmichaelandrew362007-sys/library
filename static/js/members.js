/**
 * LibraVault — Student Management
 */

let currentMembersData = [];

document.addEventListener('DOMContentLoaded', function() {
    loadMembers();

    const searchInput = document.getElementById('memberSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(loadMembers, 300));
    }
});

async function loadMembers() {
    const query = document.getElementById('memberSearch')?.value || '';
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    try {
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        const members = await apiFetch(`/api/members${params}`);
        currentMembersData = members;

        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No students found</td></tr>';
            return;
        }

        tbody.innerHTML = members.map(m => `
            <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.roll_no}</td>
                <td>${m.department || '—'}</td>
                <td>${m.year || '—'}</td>
                <td>${m.username}</td>
                <td><span class="status-badge status-${m.status}">${m.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button onclick="openEditMemberModal(${m.member_id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="viewHistory(${m.member_id}, '${m.name.replace(/"/g, '&quot;').replace(/'/g, "\\'")}')" title="History">
                            <i class="fas fa-history"></i>
                        </button>
                        ${m.role !== 'admin' ? `
                        <button onclick="openMessageModal(${m.member_id}, '${m.name.replace(/"/g, '&quot;').replace(/'/g, "\\'")}')" title="Send Reminder">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button onclick="toggleMemberStatus(${m.member_id}, '${m.status}')" title="${m.status === 'active' ? 'Deactivate' : 'Activate'}">
                            <i class="fas fa-${m.status === 'active' ? 'user-slash' : 'user-check'}"></i>
                        </button>
                        <button onclick="deleteMember(${m.member_id}, '${m.name.replace(/"/g, '&quot;').replace(/'/g, "\\'")}')" title="Delete" style="color: var(--danger)">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load</td></tr>';
    }
}

function openAddMemberModal() {
    document.getElementById('memberModalTitle').textContent = 'Add New Student';
    document.getElementById('editMemberId').value = '';
    document.getElementById('memberForm').reset();
    document.getElementById('passwordGroup').style.display = 'block';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('memberModal')).show();
}

async function openEditMemberModal(memberId) {
    try {
        const m = await apiFetch(`/api/members/${memberId}`);
        document.getElementById('memberModalTitle').textContent = 'Edit Student';
        document.getElementById('editMemberId').value = memberId;
        document.getElementById('memberName').value = m.name;
        document.getElementById('memberRollNo').value = m.roll_no;
        document.getElementById('memberDept').value = m.department || '';
        document.getElementById('memberYear').value = m.year || '';
        document.getElementById('memberUsername').value = m.username;
        document.getElementById('memberContact').value = m.contact || '';
        document.getElementById('passwordGroup').style.display = 'none';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('memberModal')).show();
    } catch (err) {
        console.error('Failed to load student:', err);
    }
}

async function saveMember() {
    const memberId = document.getElementById('editMemberId').value;
    const data = {
        name: document.getElementById('memberName').value.trim(),
        roll_no: document.getElementById('memberRollNo').value.trim(),
        department: document.getElementById('memberDept').value.trim(),
        year: document.getElementById('memberYear').value.trim(),
        username: document.getElementById('memberUsername').value.trim(),
        contact: document.getElementById('memberContact').value.trim(),
    };

    if (!data.name || !data.roll_no || !data.username) {
        showToast('Name, roll number, and username are required', 'warning');
        return;
    }

    // Add password for new students
    if (!memberId) {
        const pw = document.getElementById('memberPassword').value;
        data.password = pw || 'student123';
        data.role = 'student';
    }

    try {
        if (memberId) {
            await apiFetch(`/api/members/${memberId}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Student updated!', 'success');
        } else {
            await apiFetch('/api/members', { method: 'POST', body: JSON.stringify(data) });
            showToast('Student registered!', 'success');
        }
        bootstrap.Modal.getInstance(document.getElementById('memberModal')).hide();
        loadMembers();
    } catch (err) {
        // handled by apiFetch
    }
}

async function toggleMemberStatus(memberId, currentStatus) {
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';
    if (!await customConfirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this student?`)) return;

    try {
        await apiFetch(`/api/members/${memberId}/${action}`, { method: 'POST' });
        showToast(`Student ${action}d`, 'success');
        loadMembers();
    } catch (err) {
        // handled
    }
}

async function deleteMember(memberId, name) {
    if (!await customConfirm(`Are you sure you want to PERMANENTLY delete ${name} and ALL their records? This cannot be undone.`)) return;

    try {
        await apiFetch(`/api/members/${memberId}`, { method: 'DELETE' });
        showToast('Student permanently deleted', 'success');
        loadMembers();
    } catch (err) {
        // handled in apiFetch
    }
}

async function viewHistory(memberId, name) {
    document.getElementById('historyModalTitle').textContent = `Borrowing History — ${name}`;
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('historyModal')).show();

    try {
        const history = await apiFetch(`/api/members/${memberId}/history`);

        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No borrowing history</td></tr>';
            return;
        }

        tbody.innerHTML = history.map(h => `
            <tr>
                <td>${h.title}</td>
                <td>${h.issue_date}</td>
                <td>${h.due_date}</td>
                <td>${h.return_date || '—'}</td>
                <td>${h.fine_amount > 0 ? '₹' + parseFloat(h.fine_amount).toFixed(2) : '—'}</td>
                <td><span class="status-badge status-${h.status}">${h.status}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load</td></tr>';
    }
}

function openMessageModal(memberId, name) {
    document.getElementById('messageModalTitle').textContent = `Send Message to ${name}`;
    document.getElementById('messageMemberId').value = memberId;
    document.getElementById('messageText').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('messageModal')).show();
}

async function sendMessage() {
    const memberId = document.getElementById('messageMemberId').value;
    const text = document.getElementById('messageText').value.trim();
    if (!text) {
        showToast('Message cannot be empty', 'warning');
        return;
    }
    try {
        await apiFetch('/api/messages/send', {
            method: 'POST',
            body: JSON.stringify({ member_id: memberId, message: text })
        });
        showToast('Message sent successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('messageModal')).hide();
    } catch (err) {
        // Handled in apiFetch
    }
}

function exportMembersPDF() {
    if (!currentMembersData || !currentMembersData.length) {
        showToast('No student data to export', 'warning');
        return;
    }
    if (!window.jspdf) {
        showToast('PDF export library is not loaded', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Student List', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    const rows = currentMembersData.map(m => [
        m.name,
        m.roll_no,
        m.department || '—',
        m.year || '—',
        m.username,
        m.status
    ]);
    
    doc.autoTable({
        head: [['Name', 'Roll No', 'Department', 'Year', 'Username', 'Status']],
        body: rows,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [108, 92, 231] }
    });
    
    doc.save('student_list.pdf');
    showToast('PDF exported successfully!', 'success');
}
