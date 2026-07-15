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
    if (type === 'image') {
        document.getElementById('importModalTitle').textContent = 'Import Books from Image';
        document.getElementById('importFileLabel').textContent = 'Select Image (Receipt/Invoice)';
        fileInput.accept = 'image/png, image/jpeg, image/jpg';
    } else {
        document.getElementById('importModalTitle').textContent = 'Import Books from PDF';
        document.getElementById('importFileLabel').textContent = 'Select PDF Document';
        fileInput.accept = '.pdf';
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
        let extractedText = "";
        let tesseractWorker = null;

        if (type === 'pdf') {
            // PDF.js extraction
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            for (let i = 1; i <= pdf.numPages; i++) {
                document.querySelector('#importLoading p').textContent = `Analyzing page ${i} of ${pdf.numPages}...`;
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                let items = textContent.items;
                items.sort((a, b) => {
                    // Sort by Y (descending) then by X (ascending)
                    if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
                        return b.transform[5] - a.transform[5];
                    }
                    return a.transform[4] - b.transform[4];
                });
                
                let linesArr = [];
                let currentLineArr = [];
                let currentY = items.length > 0 ? items[0].transform[5] : 0;
                
                for (let item of items) {
                    if (Math.abs(item.transform[5] - currentY) > 5) {
                        linesArr.push(currentLineArr.join(' '));
                        currentLineArr = [];
                        currentY = item.transform[5];
                    }
                    currentLineArr.push(item.str);
                }
                if (currentLineArr.length > 0) linesArr.push(currentLineArr.join(' '));
                let pageText = linesArr.join('\n');
                
                // If text is very short, it's likely a scanned PDF image. Fallback to OCR.
                if (pageText.trim().length < 50) {
                    document.querySelector('#importLoading p').textContent = `Running OCR on scanned page ${i} of ${pdf.numPages}...`;
                    
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    
                    if (!tesseractWorker) {
                        tesseractWorker = await Tesseract.createWorker('eng');
                    }
                    // Tesseract accepts a canvas element directly
                    const { data: { text } } = await tesseractWorker.recognize(canvas);
                    pageText = text;
                }
                
                extractedText += pageText + "\n";
            }
        } else if (type === 'image') {
            document.querySelector('#importLoading p').textContent = 'Running OCR on image... this might take a minute.';
            if (!tesseractWorker) {
                tesseractWorker = await Tesseract.createWorker('eng');
            }
            const { data: { text } } = await tesseractWorker.recognize(file);
            extractedText = text;
        }

        if (tesseractWorker) {
            await tesseractWorker.terminate();
        }
        
        document.querySelector('#importLoading p').textContent = 'Extracting books...';

        // Basic parsing logic: Split text by lines, ignore short lines
        const lines = extractedText.split('\n').map(line => line.trim()).filter(line => line.length > 3);
        
        extractedBooks = [];
        
        for (let line of lines) {
            const lowerLine = line.toLowerCase();
            if (['invoice', 'receipt', 'total', 'tax', 'date', 'amount', 'qty', 'price', 'shop', 's.no', 'discount', 'rupees'].some(keyword => lowerLine.includes(keyword))) {
                continue;
            }
            
            let title = line;
            let author = "Unknown";
            
            if (lowerLine.includes(" by ")) {
                const parts = line.split(/ by /i);
                title = parts[0].trim();
                author = parts.slice(1).join(" by ").trim();
            } else if (line.includes("-")) {
                const parts = line.split("-");
                title = parts[0].trim();
                author = parts.slice(1).join("-").trim();
            } else {
                // Heuristic for tabular invoice lines: [S.No] [Author] [Title] [Publisher] [Qty] [Rate] [Amount]
                // Strip trailing columns (Quantity, Rate, Amount) which are numbers, possibly prefixed by Rs
                let cleaned = line.replace(/(\s+(?:Rs\.?|INR)?\s*[\d\.,]+\s*){2,}$/i, '').trim();
                // Strip leading S.No (number followed by space)
                cleaned = cleaned.replace(/^\d+\s+/, '').trim();
                
                if (cleaned.length > 3) {
                    const parts = cleaned.split(/\s+/);
                    if (parts.length > 1) {
                        // Guess first word is author
                        author = parts[0];
                        title = parts.slice(1).join(' ');
                    } else {
                        title = cleaned;
                    }
                } else {
                    continue;
                }
            }
            
            // Ignore lines that are just numbers (like prices)
            if (title.replace(/\./g, '').replace(/ /g, '').match(/^\d+$/)) {
                continue;
            }
            
            extractedBooks.push({
                title: title,
                author: author
            });
        }
        
        renderImportPreview();
        
        document.getElementById('importPreviewSection').style.display = 'block';
        document.getElementById('confirmImportBtn').style.display = 'inline-block';
        document.getElementById('extractBtn').style.display = 'none';
        showToast('Extraction complete. Please review the books.', 'info');
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to extract text from file', 'error');
    } finally {
        document.getElementById('importLoading').style.display = 'none';
        document.getElementById('extractBtn').disabled = false;
        document.querySelector('#importLoading p').textContent = 'Analyzing file and extracting books... please wait.';
    }
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
            <td><input type="text" class="form-control form-control-sm glass-input" value="${b.title}" id="importTitle_${idx}"></td>
            <td><input type="text" class="form-control form-control-sm glass-input" value="${b.author || 'Unknown'}" id="importAuthor_${idx}"></td>
            <td><input type="number" class="form-control form-control-sm glass-input" value="1" id="importCopies_${idx}" style="width:60px;"></td>
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
        const copiesEl = document.getElementById(`importCopies_${i}`);
        
        if (!titleEl || !authorEl || !titleEl.value.trim()) continue;

        const data = {
            title: titleEl.value.trim(),
            author: authorEl.value.trim() || 'Unknown',
            isbn: '',
            category: 'Imported',
            publisher: '',
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
