/**
 * LibraVault — Common Utilities & Helpers
 */

// ─── Date Display ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    // Sidebar toggle for mobile
    const mobileToggle = document.getElementById('mobileToggle');
    const sidebar = document.getElementById('sidebar');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar on clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') &&
                !sidebar.contains(e.target) &&
                !mobileToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }

    // ─── Theme Switcher Logic ────────────────────────────────
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const theme = this.getAttribute('data-set-theme');
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('libravault_theme', theme);
            
            // Toggle flatpickr dark theme based on selected theme
            const fpTheme = document.getElementById('flatpickr-theme');
            if (fpTheme) {
                if (theme === 'white' || theme === 'apple-glass') {
                    fpTheme.disabled = true;
                } else {
                    fpTheme.disabled = false;
                }
            }
        });
    });

    // Initialize Flatpickr for date inputs
    if (typeof flatpickr !== 'undefined') {
        flatpickr("input[type='date']", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "F j, Y",
            allowInput: true
        });
        
        // Initial theme setup for flatpickr
        const savedTheme = localStorage.getItem('libravault_theme') || 'black';
        const fpTheme = document.getElementById('flatpickr-theme');
        if (fpTheme && (savedTheme === 'white' || savedTheme === 'apple-glass')) {
            fpTheme.disabled = true;
        }
    }
});

// ─── Toast Notification System ─────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `
        <i class="${icons[type] || icons.info} toast-icon"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ─── Fetch Helper ──────────────────────────────────────────
async function apiFetch(url, options = {}) {
    try {
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json' },
        };
        const res = await fetch(url, { ...defaultOptions, ...options });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// ─── Debounce Helper ───────────────────────────────────────
function debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ─── Category Color Map ────────────────────────────────────
const categoryColors = {
    'Computer Science': { bg: 'rgba(108, 92, 231, 0.15)', color: '#a29bfe', icon: 'fas fa-laptop-code' },
    'Mathematics': { bg: 'rgba(0, 184, 148, 0.15)', color: '#00b894', icon: 'fas fa-square-root-variable' },
    'Physics': { bg: 'rgba(116, 185, 255, 0.15)', color: '#74b9ff', icon: 'fas fa-atom' },
    'Electronics': { bg: 'rgba(253, 203, 110, 0.15)', color: '#fdcb6e', icon: 'fas fa-microchip' },
    'Mechanical': { bg: 'rgba(225, 112, 85, 0.15)', color: '#e17055', icon: 'fas fa-cogs' },
    'default': { bg: 'rgba(162, 155, 254, 0.15)', color: '#a29bfe', icon: 'fas fa-book' }
};

function getCategoryStyle(category) {
    return categoryColors[category] || categoryColors['default'];
}

// ─── Custom Confirm Dialog ───────────────────────────────
function customConfirm(message) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('customConfirmModal');
        if (!modalEl) {
            resolve(confirm(message));
            return;
        }
        
        document.getElementById('customConfirmMessage').textContent = message;
        
        const bsModal = new bootstrap.Modal(modalEl);
        
        const btnOk = document.getElementById('customConfirmOk');
        const btnCancel = document.getElementById('customConfirmCancel');
        
        // Remove old listeners by replacing elements
        const newBtnOk = btnOk.cloneNode(true);
        const newBtnCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
        
        newBtnOk.addEventListener('click', () => {
            bsModal.hide();
            resolve(true);
        });
        
        newBtnCancel.addEventListener('click', () => {
            bsModal.hide();
            resolve(false);
        });
        
        modalEl.addEventListener('hidden.bs.modal', function onHidden() {
            modalEl.removeEventListener('hidden.bs.modal', onHidden);
            resolve(false);
        });
        
        bsModal.show();
    });
}
