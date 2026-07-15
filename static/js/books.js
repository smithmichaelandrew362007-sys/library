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

// ─── Import Books Operations ──────────────────────────────────
let extractedBooks = [];

function openImportModal(type) {
    document.getElementById('importBookForm').reset();
    document.getElementById('importType').value = type;
    document.getElementById('importPreviewSection').style.display = 'none';
    document.getElementById('confirmImportBtn').style.display = 'none';
    document.getElementById('extractBtn').style.display = 'inline-block';
    document.getElementById('importLoading').style.display = 'none';
    extractedBooks = [];

    const fileInput = document.getElementById('importFile');
    if (type === 'csv') {
        document.getElementById('importModalTitle').textContent = 'Import Books from CSV';
        document.getElementById('importFileLabel').textContent = 'Select CSV File';
        fileInput.accept = '.csv';
    } else if (type === 'excel') {
        document.getElementById('importModalTitle').textContent = 'Import Books from Excel';
        document.getElementById('importFileLabel').textContent = 'Select Excel File (.xlsx, .xls)';
        fileInput.accept = '.xlsx, .xls';
    } else {
        document.getElementById('importModalTitle').textContent = 'Import Books from Image';
        document.getElementById('importFileLabel').textContent = 'Select Image (Receipt/Invoice)';
        fileInput.accept = 'image/png, image/jpeg, image/jpg';
    }
    
    new bootstrap.Modal(document.getElementById('importBookModal')).show();
}

async function processImportFile() {
    const fileInput = document.getElementById('importFile');
    if (!fileInput.files.length) {
        showToast('Please select a file first', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const type = document.getElementById('importType').value;
    
    document.getElementById('importLoading').style.display = 'block';
    document.getElementById('extractBtn').disabled = true;

    try {
        if (type === 'csv') {
            // ── CSV Parsing (client-side) ──
            document.querySelector('#importLoading p').textContent = 'Parsing CSV file...';
            const text = await file.text();
            extractedBooks = parseCSVToBooks(text);

        } else if (type === 'excel') {
            // ── Excel Parsing (client-side via SheetJS) ──
            document.querySelector('#importLoading p').textContent = 'Parsing Excel file...';
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
            extractedBooks = parseRowsToBooks(rows);

        } else if (type === 'image') {
            // ── Image OCR (Tesseract) + Gemini AI extraction ──
            document.querySelector('#importLoading p').textContent = 'Running OCR on image... this might take a minute.';
            const tesseractWorker = await Tesseract.createWorker('eng');
            const { data: { text } } = await tesseractWorker.recognize(file);
            await tesseractWorker.terminate();

            let extractedText = text;
            document.querySelector('#importLoading p').textContent = 'Extracting books using AI...';

            try {
                const aiRes = await apiFetch('/api/books/parse-import', {
                    method: 'POST',
                    body: JSON.stringify({ text: extractedText })
                });
                extractedBooks = aiRes.books || [];
            } catch (apiErr) {
                console.error("AI Parse Error:", apiErr);
                showToast('AI Extraction failed. Please try again.', 'error');
                extractedBooks = [];
            }
        }
        
        renderImportPreview();
        
        document.getElementById('importPreviewSection').style.display = 'block';
        document.getElementById('confirmImportBtn').style.display = 'inline-block';
        document.getElementById('extractBtn').style.display = 'none';
        showToast('Extraction complete. Please review the books.', 'info');
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to extract data from file', 'error');
    } finally {
        document.getElementById('importLoading').style.display = 'none';
        document.getElementById('extractBtn').disabled = false;
        document.querySelector('#importLoading p').textContent = 'Analyzing file and extracting books... please wait.';
    }
}

/**
 * Parse CSV text into book objects.
 * Matches columns by header name (case-insensitive, flexible naming).
 */
function parseCSVToBooks(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse header row
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Map known column names to our fields
    const titleIdx = headers.findIndex(h => /title|book.?name|name/i.test(h));
    const authorIdx = headers.findIndex(h => /author/i.test(h));
    const publisherIdx = headers.findIndex(h => /publish/i.test(h));
    const copiesIdx = headers.findIndex(h => /cop|qty|quantity|count/i.test(h));

    if (titleIdx === -1) {
        showToast('CSV must have a "Title" column', 'warning');
        return [];
    }

    const books = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const title = (cols[titleIdx] || '').trim();
        if (!title) continue;
        books.push({
            title: title,
            author: authorIdx >= 0 ? (cols[authorIdx] || 'Unknown').trim() : 'Unknown',
            publisher: publisherIdx >= 0 ? (cols[publisherIdx] || '').trim() : '',
            copies: copiesIdx >= 0 ? (parseInt(cols[copiesIdx]) || 1) : 1
        });
    }
    return books;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result;
}

/**
 * Parse Excel/SheetJS row objects into book objects.
 * Matches keys by flexible column name patterns.
 */
function parseRowsToBooks(rows) {
    if (!rows.length) return [];

    // Get actual column keys from the first row
    const keys = Object.keys(rows[0]);
    const findKey = (pattern) => keys.find(k => pattern.test(k.toLowerCase().trim()));

    const titleKey = findKey(/title|book.?name|name/i);
    const authorKey = findKey(/author/i);
    const publisherKey = findKey(/publish/i);
    const copiesKey = findKey(/cop|qty|quantity|count/i);

    if (!titleKey) {
        showToast('Excel sheet must have a "Title" column', 'warning');
        return [];
    }

    return rows
        .filter(r => String(r[titleKey] || '').trim())
        .map(r => ({
            title: String(r[titleKey] || '').trim(),
            author: authorKey ? String(r[authorKey] || 'Unknown').trim() : 'Unknown',
            publisher: publisherKey ? String(r[publisherKey] || '').trim() : '',
            copies: copiesKey ? (parseInt(r[copiesKey]) || 1) : 1
        }));
}

function renderImportPreview() {
    document.getElementById('extractedCount').textContent = extractedBooks.length;
    const tbody = document.getElementById('importPreviewTableBody');
    
    if (extractedBooks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No books extracted</td></tr>';
        return;
    }

    tbody.innerHTML = extractedBooks.map((b, idx) => `
        <tr>
            <td><input type="text" class="form-control form-control-sm glass-input" value="${b.title || ''}" id="importTitle_${idx}"></td>
            <td><input type="text" class="form-control form-control-sm glass-input" value="${b.author || 'Unknown'}" id="importAuthor_${idx}"></td>
            <td><input type="text" class="form-control form-control-sm glass-input" value="${b.publisher || ''}" id="importPublisher_${idx}"></td>
            <td><input type="number" class="form-control form-control-sm glass-input" value="${b.copies || 1}" id="importCopies_${idx}" style="width:60px;"></td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="removeExtractedBook(${idx})"><i class="fas fa-times"></i></button>
            </td>
        </tr>
    `).join('');
}

function removeExtractedBook(idx) {
    extractedBooks.splice(idx, 1);
    renderImportPreview();
}

async function confirmImport() {
    if (extractedBooks.length === 0) {
        showToast('No books to import', 'warning');
        return;
    }

    const confirmBtn = document.getElementById('confirmImportBtn');
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    confirmBtn.disabled = true;

    let successCount = 0;
    
    // Save each book sequentially
    for (let i = 0; i < extractedBooks.length; i++) {
        const titleEl = document.getElementById(`importTitle_${i}`);
        const authorEl = document.getElementById(`importAuthor_${i}`);
        const pubEl = document.getElementById(`importPublisher_${i}`);
        const copiesEl = document.getElementById(`importCopies_${i}`);
        
        if (!titleEl || !authorEl || !titleEl.value.trim()) continue;

        const data = {
            title: titleEl.value.trim(),
            author: authorEl.value.trim() || 'Unknown',
            isbn: '',
            category: 'Imported',
            publisher: pubEl ? pubEl.value.trim() : '',
            edition: '',
            total_copies: parseInt(copiesEl.value) || 1,
            available_copies: parseInt(copiesEl.value) || 1
        };

        try {
            await fetch('/api/books', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            successCount++;
        } catch (err) {
            console.error('Failed to save book:', data.title, err);
        }
    }

    showToast(`Successfully imported ${successCount} books!`, 'success');
    bootstrap.Modal.getInstance(document.getElementById('importBookModal')).hide();
    loadBooks();
    
    confirmBtn.innerHTML = '<i class="fas fa-check"></i> Add Books to Library';
    confirmBtn.disabled = false;
}
