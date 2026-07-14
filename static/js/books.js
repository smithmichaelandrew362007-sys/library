/**
 * LibraVault — Book Catalog Management
 */

let currentBooksData = [];

document.addEventListener('DOMContentLoaded', function() {
    loadBooks();

    // Live search with debounce
    const searchInput = document.getElementById('bookSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(loadBooks, 300));
    }

    // Category filter
    const filterSelect = document.getElementById('categoryFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', loadBooks);
    }
});

async function loadBooks() {
    const query = document.getElementById('bookSearch')?.value || '';
    const category = document.getElementById('categoryFilter')?.value || 'all';
    const grid = document.getElementById('booksGrid');
    if (!grid) return;

    try {
        let url = '/api/books';
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (category !== 'all') params.set('filter', 'category');
        if (category !== 'all') params.set('q', category);
        if (query && category !== 'all') {
            // Both query and category: search within category
            params.set('q', query);
            params.set('filter', 'all');
        }

        const books = await apiFetch(`${url}?${params.toString()}`);
        currentBooksData = books;

        // Filter by category if needed (client-side for combined search)
        let filtered = books;
        if (category !== 'all' && query) {
            filtered = books.filter(b => b.category === category);
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No books found</p>
                </div>`;
            return;
        }

        grid.innerHTML = filtered.map(book => renderBookCard(book)).join('');
    } catch (err) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load books</p></div>';
    }
}

function renderBookCard(book) {
    const style = getCategoryStyle(book.category);
    const availRatio = book.available_copies / book.total_copies;
    let availClass = 'avail-high';
    let availText = `${book.available_copies} / ${book.total_copies} available`;

    if (book.available_copies === 0) {
        availClass = 'avail-none';
        availText = 'Unavailable';
    } else if (availRatio <= 0.3) {
        availClass = 'avail-low';
    }

    // Check if user is admin (check for edit/delete buttons)
    const isAdmin = document.getElementById('addBookBtn') !== null;

    return `
    <div class="book-card glass-card">
        <div class="book-card-header">
            <div>
                <div class="book-title">${book.title}</div>
                <div class="book-author">${book.author}</div>
            </div>
            <div class="book-icon" style="background: ${style.bg}; color: ${style.color};">
                <i class="${style.icon}"></i>
            </div>
        </div>
        <div class="book-meta">
            <span><i class="fas fa-tag"></i> ${book.category}</span>
            ${book.isbn ? `<span><i class="fas fa-barcode"></i> ${book.isbn}</span>` : ''}
            ${book.edition ? `<span><i class="fas fa-layer-group"></i> ${book.edition}</span>` : ''}
        </div>
        <div class="book-footer">
            <span class="availability-badge ${availClass}">
                <i class="fas fa-circle" style="font-size: 0.5rem;"></i>
                ${availText}
            </span>
            ${isAdmin ? `
            <div class="book-actions">
                <button onclick="openEditBookModal(${book.book_id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" onclick="deleteBook(${book.book_id}, '${book.title.replace(/'/g, "\\'")}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>` : (book.available_copies > 0 ? `
            <div class="book-actions">
                <button class="action-btn primary" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem;" onclick="preBook(${book.book_id})" title="Pre-book this book">
                    Pre-Book
                </button>
            </div>` : '')}
        </div>
    </div>`;
}

async function preBook(bookId) {
    if (!await customConfirm('Are you sure you want to pre-book this book? You must collect it from the library within 2 days.')) return;
    try {
        const res = await apiFetch('/api/issues/pre-book', {
            method: 'POST',
            body: JSON.stringify({ book_id: bookId })
        });
        showToast(res.message, 'success');
        loadBooks(); // refresh list to update copies
    } catch (err) {
        showToast(err.message || 'Failed to pre-book', 'error');
    }
}

// ─── Modal Operations ──────────────────────────────────────

function openAddBookModal() {
    document.getElementById('bookModalTitle').textContent = 'Add New Book';
    document.getElementById('editBookId').value = '';
    document.getElementById('bookForm').reset();
    document.getElementById('bookCategory').value = 'General';
    document.getElementById('bookTotalCopies').value = 1;
    document.getElementById('availableCopiesGroup').style.display = 'none';
    new bootstrap.Modal(document.getElementById('bookModal')).show();
}

async function openEditBookModal(bookId) {
    try {
        const book = await apiFetch(`/api/books/${bookId}`);
        document.getElementById('bookModalTitle').textContent = 'Edit Book';
        document.getElementById('editBookId').value = bookId;
        document.getElementById('bookTitle').value = book.title;
        document.getElementById('bookAuthor').value = book.author;
        document.getElementById('bookIsbn').value = book.isbn || '';
        document.getElementById('bookCategory').value = book.category || 'General';
        document.getElementById('bookPublisher').value = book.publisher || '';
        document.getElementById('bookEdition').value = book.edition || '';
        document.getElementById('bookTotalCopies').value = book.total_copies;
        document.getElementById('bookAvailableCopies').value = book.available_copies;
        document.getElementById('availableCopiesGroup').style.display = 'block';
        new bootstrap.Modal(document.getElementById('bookModal')).show();
    } catch (err) {
        console.error('Failed to load book:', err);
    }
}

async function saveBook() {
    const bookId = document.getElementById('editBookId').value;
    const data = {
        title: document.getElementById('bookTitle').value.trim(),
        author: document.getElementById('bookAuthor').value.trim(),
        isbn: document.getElementById('bookIsbn').value.trim(),
        category: document.getElementById('bookCategory').value.trim() || 'General',
        publisher: document.getElementById('bookPublisher').value.trim(),
        edition: document.getElementById('bookEdition').value.trim(),
        total_copies: parseInt(document.getElementById('bookTotalCopies').value) || 1,
        available_copies: parseInt(document.getElementById('bookAvailableCopies')?.value) || parseInt(document.getElementById('bookTotalCopies').value) || 1,
    };

    if (!data.title || !data.author) {
        showToast('Title and author are required', 'warning');
        return;
    }

    try {
        if (bookId) {
            await apiFetch(`/api/books/${bookId}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Book updated successfully!', 'success');
        } else {
            await apiFetch('/api/books', { method: 'POST', body: JSON.stringify(data) });
            showToast('Book added successfully!', 'success');
        }
        bootstrap.Modal.getInstance(document.getElementById('bookModal')).hide();
        loadBooks();
    } catch (err) {
        // Error already shown by apiFetch
    }
}

async function deleteBook(bookId, title) {
    if (!await customConfirm(`Delete "${title}"? This cannot be undone.`)) return;

    try {
        await apiFetch(`/api/books/${bookId}`, { method: 'DELETE' });
        showToast('Book deleted', 'success');
        loadBooks();
    } catch (err) {
        // Error shown by apiFetch
    }
}

// ─── Barcode Scanning ──────────────────────────────────────

let html5QrcodeScanner = null;

function startScanner() {
    const readerDiv = document.getElementById('reader');
    if (readerDiv.style.display === 'block') {
        // Stop scanning
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().then(() => {
                readerDiv.style.display = 'none';
            });
        }
        return;
    }

    readerDiv.style.display = 'block';
    
    // Initialize html5-qrcode
    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: {width: 250, height: 100} },
        false);
        
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function onScanSuccess(decodedText, decodedResult) {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().then(() => {
            document.getElementById('reader').style.display = 'none';
            document.getElementById('bookIsbn').value = decodedText;
            showToast('Barcode scanned! Fetching book details...', 'info');
            fetchBookDetails(decodedText);
        });
    }
}

function onScanFailure(error) {
    // Ignore ongoing scan failures
}

async function fetchBookDetails(isbn) {
    try {
        const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`);
        const data = await response.json();
        const bookKey = `ISBN:${isbn}`;
        
        if (data && data[bookKey]) {
            const bookInfo = data[bookKey];
            
            document.getElementById('bookTitle').value = bookInfo.title || '';
            
            if (bookInfo.authors && bookInfo.authors.length > 0) {
                document.getElementById('bookAuthor').value = bookInfo.authors.map(a => a.name).join(', ');
            }
            
            if (bookInfo.publishers && bookInfo.publishers.length > 0) {
                document.getElementById('bookPublisher').value = bookInfo.publishers.map(p => p.name).join(', ');
            }
            
            showToast('Book details auto-filled!', 'success');
        } else {
            showToast('Book not found in online database. Please fill manually.', 'warning');
        }
    } catch (err) {
        console.error("Error fetching book details:", err);
        showToast('Failed to fetch book details automatically.', 'warning');
    }
}

function exportBooksPDF() {
    if (!currentBooksData || !currentBooksData.length) {
        showToast('No book data to export', 'warning');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Book Catalog', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    const rows = currentBooksData.map(b => [
        b.title,
        b.author,
        b.isbn || '—',
        b.category || '—',
        b.publisher || '—',
        b.edition || '—',
        `${b.available_copies} / ${b.total_copies}`
    ]);
    
    doc.autoTable({
        head: [['Title', 'Author', 'ISBN', 'Category', 'Publisher', 'Edition', 'Available']],
        body: rows,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [108, 92, 231] }
    });
    
    doc.save('book_catalog.pdf');
    showToast('PDF exported successfully!', 'success');
}
