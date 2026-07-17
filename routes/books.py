"""
Book management routes — CRUD and search APIs.
"""

from flask import Blueprint, request, render_template, jsonify, session
from routes.auth import login_required, admin_required
from models import book as book_model
import config
import json
import google.generativeai as genai
from utils.cache import cache

books_bp = Blueprint('books', __name__)


@books_bp.route('/books')
@login_required
def books_page():
    """Render book catalog page."""
    categories = book_model.get_categories()
    return render_template('books.html',
                           app_name=config.APP_NAME,
                           categories=categories,
                           user_name=session.get('name'),
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

    books_list = []
    for b in books:
        b_dict = dict(b)
        if b_dict.get('added_date') and hasattr(b_dict['added_date'], 'strftime'):
            b_dict['added_date'] = b_dict['added_date'].strftime('%Y-%m-%d %H:%M:%S')
        books_list.append(b_dict)

    return jsonify(books_list)


@books_bp.route('/api/books/<int:book_id>', methods=['GET'])
@login_required
def api_get_book(book_id):
    """API: Get a single book."""
    b = book_model.get_book_by_id(book_id)
    if not b:
        return jsonify({'error': 'Book not found'}), 404
    b_dict = dict(b)
    if b_dict.get('added_date') and hasattr(b_dict['added_date'], 'strftime'):
        b_dict['added_date'] = b_dict['added_date'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(b_dict)


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
@cache.cached(timeout=300)
def api_get_categories():
    """API: Get all book categories."""
    return jsonify(book_model.get_categories())


@books_bp.route('/api/books/most-borrowed', methods=['GET'])
@login_required
@cache.cached(timeout=300, query_string=True)
def api_most_borrowed():
    """API: Get most borrowed books."""
    limit = request.args.get('limit', 10, type=int)
    books = book_model.get_most_borrowed(limit)
    for b in books:
        if b.get('added_date') and hasattr(b['added_date'], 'strftime'):
            b['added_date'] = b['added_date'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(books)


@books_bp.route('/api/books/parse-import', methods=['POST'])
@admin_required
def api_parse_import():
    """API: Parse raw text into structured book JSON using Gemini API."""
    if not config.GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key is not configured on the server."}), 500

    data = request.get_json()
    raw_text = data.get('text', '')
    if not raw_text:
        return jsonify({"error": "No text provided"}), 400

    try:
        genai.configure(api_key=config.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
        You are an intelligent data extraction assistant. I will provide you with raw text extracted from a scanned book invoice or receipt. The text might be messy and the column order might vary, but it generally contains tabular data with columns such as S.No, Author, Title, Publisher, Quantity, Rate, Amount.
        
        Your task is to extract the list of books from this text and return it as a JSON array of objects. 
        Each object MUST have exactly these keys:
        - "title" (string)
        - "author" (string, use "Unknown" if not present)
        - "publisher" (string, use "" if not present)
        - "copies" (integer, default to 1 if not clearly specified)

        Ignore any rows that are just totals, discounts, or headers. Focus only on the books.
        
        Raw Text:
        {raw_text}
        
        Return ONLY valid JSON. No markdown formatting, no backticks, no extra text.
        """
        
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        # Parse the returned JSON text
        books_list = json.loads(response.text)
        return jsonify({"books": books_list})

    except Exception as e:
        print("Gemini Extraction Error:", e)
        return jsonify({"error": "Failed to extract books using AI"}), 500
