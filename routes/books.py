"""
Book management routes — CRUD and search APIs.
"""

from flask import Blueprint, request, render_template, jsonify, session
from routes.auth import login_required, admin_required
from models import book as book_model
import config
import os
import io
import PyPDF2
try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None

books_bp = Blueprint('books', __name__)


@books_bp.route('/books')
@login_required
def books_page():
    """Render book catalog page."""
    categories = book_model.get_categories()
    return render_template('books.html',
                           app_name=config.APP_NAME,
                           categories=categories,
                           user_name=session.get('user_name'),
                           role=session.get('role'))


@books_bp.route('/api/books', methods=['GET'])
@login_required
def api_get_books():
    """API: Get all books or search."""
    query = request.args.get('q', '').strip()
    filter_by = request.args.get('filter', 'all')

    if query:
        books = book_model.search_books(query, filter_by)
    else:
        books = book_model.get_all_books()

    # Convert date objects to strings for JSON
    for b in books:
        if b.get('added_date') and hasattr(b['added_date'], 'strftime'):
            b['added_date'] = b['added_date'].strftime('%Y-%m-%d %H:%M:%S')

    return jsonify(books)


@books_bp.route('/api/books/<int:book_id>', methods=['GET'])
@login_required
def api_get_book(book_id):
    """API: Get a single book."""
    b = book_model.get_book(book_id)
    if not b:
        return jsonify({'error': 'Book not found'}), 404
    if b.get('added_date') and hasattr(b['added_date'], 'strftime'):
        b['added_date'] = b['added_date'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(b)


@books_bp.route('/api/books', methods=['POST'])
@admin_required
def api_add_book():
    """API: Add a new book (admin only)."""
    data = request.get_json()
    if not data.get('title') or not data.get('author'):
        return jsonify({'error': 'Title and author are required'}), 400
    book_id = book_model.add_book(data)
    return jsonify({'success': True, 'book_id': book_id, 'message': 'Book added successfully'})


@books_bp.route('/api/books/<int:book_id>', methods=['PUT'])
@admin_required
def api_update_book(book_id):
    """API: Update a book (admin only)."""
    data = request.get_json()
    if not data.get('title') or not data.get('author'):
        return jsonify({'error': 'Title and author are required'}), 400
    book_model.update_book(book_id, data)
    return jsonify({'success': True, 'message': 'Book updated successfully'})


@books_bp.route('/api/books/<int:book_id>', methods=['DELETE'])
@admin_required
def api_delete_book(book_id):
    """API: Delete a book (admin only)."""
    success, message = book_model.delete_book(book_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message})


@books_bp.route('/api/books/categories', methods=['GET'])
@login_required
def api_get_categories():
    """API: Get all book categories."""
    return jsonify(book_model.get_categories())


@books_bp.route('/api/books/most-borrowed', methods=['GET'])
@login_required
def api_most_borrowed():
    """API: Get most borrowed books."""
    limit = request.args.get('limit', 10, type=int)
    books = book_model.get_most_borrowed(limit)
    for b in books:
        if b.get('added_date') and hasattr(b['added_date'], 'strftime'):
            b['added_date'] = b['added_date'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(books)


@books_bp.route('/api/books/import', methods=['POST'])
@admin_required
def api_import_books():
    """API: Import books from PDF or Image."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    import_type = request.form.get('type', 'pdf')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    extracted_text = ""
    
    try:
        if import_type == 'pdf':
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"
        elif import_type == 'image':
            if not pytesseract:
                return jsonify({'error': 'Image parsing not supported (pytesseract missing)'}), 500
            # Open image from stream
            image = Image.open(file.stream)
            extracted_text = pytesseract.image_to_string(image)
        else:
            return jsonify({'error': 'Invalid import type'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500
        
    # Basic parsing logic: Split text by lines, ignore short lines
    lines = [line.strip() for line in extracted_text.split('\n') if len(line.strip()) > 3]
    
    books = []
    # Very crude parsing: assume each line might be a book title, or split by some delimiter
    # For a real app this would use NLP or more structured regex, but we will return lines as titles
    # so the admin can review them in the preview table.
    for line in lines:
        # Ignore common receipt/invoice headers
        lower_line = line.lower()
        if any(keyword in lower_line for keyword in ['invoice', 'receipt', 'total', 'tax', 'date', 'amount', 'qty', 'price', 'shop']):
            continue
            
        # Try to split by ' by ' or '-' to guess author
        title = line
        author = "Unknown"
        
        if " by " in lower_line:
            parts = line.split(" by ", 1)
            title = parts[0].strip()
            author = parts[1].strip()
        elif "-" in line:
            parts = line.split("-", 1)
            title = parts[0].strip()
            author = parts[1].strip()
            
        # Ignore lines that are just numbers (like prices)
        if title.replace('.', '', 1).isdigit():
            continue
            
        books.append({
            'title': title,
            'author': author
        })
        
    return jsonify({'success': True, 'books': books})
