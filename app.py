from flask import Flask, render_template, request, jsonify
import os
import json
import threading
import time
from datetime import datetime
import logging

# Import your existing processor
from combined_sbi_processor import CombinedSBIProcessor  # Update this import path

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this'
app.config['UPLOAD_FOLDER'] = 'uploads'

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('static/css', exist_ok=True)
os.makedirs('static/js', exist_ok=True)
os.makedirs('templates', exist_ok=True)

# Initialize processor globally
processor = CombinedSBIProcessor()

# Global processing status
processing_status = {
    'status': 'idle',
    'progress': 0,
    'message': '',
    'results': None,
    'error': None
}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current processing status"""
    return jsonify(processing_status)

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get REAL transaction data from processed PDFs"""
    try:
        # Check if we have processed data
        if hasattr(processor, 'all_statements_df') and processor.all_statements_df is not None:
            # Convert DataFrame to JSON-compatible format
            df = processor.all_statements_df.copy()
            
            # Handle datetime columns
            for col in df.columns:
                if df[col].dtype == 'datetime64[ns]':
                    df[col] = df[col].dt.strftime('%Y-%m-%d')
            
            # Convert to dictionary records
            transactions = df.to_dict('records')
            
            # Calculate metadata
            total_credits = float(df['Credit'].sum()) if 'Credit' in df.columns else 0
            total_debits = float(df['Debit'].sum()) if 'Debit' in df.columns else 0
            net_flow = total_credits - total_debits
            
            response_data = {
                "metadata": {
                    "total_transactions": len(transactions),
                    "financial_summary": {
                        "total_credits": total_credits,
                        "total_debits": total_debits,
                        "net_flow": net_flow
                    }
                },
                "transactions": transactions
            }
            
            return jsonify(response_data)
        
        else:
            # No real data processed yet, return empty response
            return jsonify({
                "metadata": {
                    "total_transactions": 0,
                    "financial_summary": {
                        "total_credits": 0,
                        "total_debits": 0,
                        "net_flow": 0
                    }
                },
                "transactions": []
            })
    
    except Exception as e:
        logger.error(f"Error in get_transactions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/insights', methods=['GET'])
def get_insights():
    """Generate insights from REAL data"""
    try:
        if hasattr(processor, 'all_statements_df') and processor.all_statements_df is not None:
            df = processor.all_statements_df
            
            # Generate real insights from your data
            total_debits = float(df['Debit'].sum())
            total_credits = float(df['Credit'].sum())
            
            # Find top spending category
            if 'Category' in df.columns:
                category_spending = df[df['Type'] == 'Debit'].groupby('Category')['Debit'].sum()
                if not category_spending.empty:
                    top_category = category_spending.idxmax()
                    top_amount = category_spending.max()
                else:
                    top_category = "Unknown"
                    top_amount = 0
            else:
                top_category = "Unknown"
                top_amount = 0
            
            insights = {
                "spending_pattern": {
                    "insight": f"Your highest spending category is {top_category} with ₹{top_amount:,.2f} spent. This represents {(top_amount/total_debits*100):.1f}% of your total expenses." if total_debits > 0 else "No spending data available.",
                    "recommendation": f"Consider reviewing your {top_category} expenses to identify potential savings opportunities."
                },
                "budget_recommendation": {
                    "insight": f"Based on your total spending of ₹{total_debits:,.2f}, we recommend monitoring your monthly expenses closely.",
                    "recommendation": "Track your expenses weekly to stay within budget and identify spending patterns."
                },
                "savings_opportunity": {
                    "insight": f"You could potentially save ₹{top_amount*0.15:,.2f} by reducing {top_category} expenses by just 15%." if top_amount > 0 else "Process more data to identify savings opportunities.",
                    "recommendation": f"Set a monthly limit for {top_category} expenses." if top_category != "Unknown" else "Upload more statements for better recommendations."
                },
                "financial_health": {
                    "score": calculate_health_score(total_credits, total_debits),
                    "insight": generate_health_insight(total_credits, total_debits),
                    "recommendation": "Maintain a healthy balance between income and expenses for better financial stability."
                }
            }
            return jsonify(insights)
        else:
            # No data processed yet
            return jsonify({
                "spending_pattern": {
                    "insight": "Please extract bank statements to see your spending patterns.",
                    "recommendation": "Upload PDF files or use Gmail extraction to get started."
                },
                "budget_recommendation": {
                    "insight": "Upload your bank statements to get personalized budget recommendations.",
                    "recommendation": "We'll analyze your spending once you provide transaction data."
                },
                "savings_opportunity": {
                    "insight": "Extract your statements first to identify savings opportunities.",
                    "recommendation": "Complete the extraction process to see potential savings."
                },
                "financial_health": {
                    "score": 0,
                    "insight": "Upload statements to calculate your financial health score.",
                    "recommendation": "We need transaction data to assess your financial health."
                }
            })
    
    except Exception as e:
        logger.error(f"Error in get_insights: {str(e)}")
        return jsonify({'error': str(e)}), 500

def calculate_health_score(total_credits, total_debits):
    """Calculate financial health score from real data"""
    if total_credits == 0:
        return 0
    
    savings_rate = (total_credits - total_debits) / total_credits
    base_score = max(0, min(100, (savings_rate + 0.5) * 100))
    
    if savings_rate < 0:
        base_score = max(0, base_score - 30)
    
    return int(base_score)

def generate_health_insight(total_credits, total_debits):
    """Generate health insight from real data"""
    if total_credits == 0:
        return "Upload statements to calculate financial health."
    
    savings_rate = (total_credits - total_debits) / total_credits
    
    if savings_rate > 0.3:
        return "Excellent! You're saving more than 30% of your income."
    elif savings_rate > 0.2:
        return "Great job! You're saving 20-30% of your income."
    elif savings_rate > 0.1:
        return "Good savings rate of 10-20%. Consider increasing it gradually."
    elif savings_rate > 0:
        return "You're saving money, but consider increasing your savings rate."
    else:
        return "⚠️ You're spending more than you earn. Review your expenses immediately."

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Handle file uploads and process with your processor"""
    try:
        if 'files[]' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        files = request.files.getlist('files[]')
        uploaded_files = []
        
        for file in files:
            if file.filename == '':
                continue
            
            if file and file.filename.lower().endswith('.pdf'):
                filename = file.filename
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{timestamp}_{filename}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                uploaded_files.append(filename)
        
        if not uploaded_files:
            return jsonify({'error': 'No valid PDF files uploaded'}), 400
        
        # Start processing with your actual processor
        global processing_status
        processing_status.update({
            'status': 'processing',
            'progress': 0,
            'message': 'Processing uploaded PDF files...'
        })
        
        def process_uploaded_files():
            try:
                # Use your actual processor to process files
                processing_status.update({
                    'progress': 25,
                    'message': 'Reading PDF files...'
                })
                
                # Process all PDFs (modify this to work with your processor)
                combined_df = processor.process_all_pdfs()
                
                processing_status.update({
                    'progress': 75,
                    'message': 'Analyzing transactions...'
                })
                
                if combined_df is not None and not combined_df.empty:
                    # Save results
                    json_filename = processor.save_results(combined_df)
                    
                    processing_status.update({
                        'status': 'completed',
                        'progress': 100,
                        'message': f'Successfully processed {len(combined_df)} transactions!'
                    })
                else:
                    processing_status.update({
                        'status': 'error',
                        'error': 'No transactions found in uploaded files'
                    })
                    
            except Exception as e:
                processing_status.update({
                    'status': 'error',
                    'error': f'Processing error: {str(e)}'
                })
        
        # Start background processing
        thread = threading.Thread(target=process_uploaded_files)
        thread.start()
        
        return jsonify({
            'message': f'Successfully uploaded {len(uploaded_files)} file(s). Processing started.',
            'files': uploaded_files
        })
    
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/gmail-extract', methods=['POST'])
def gmail_extract():
    """Handle Gmail extraction using your actual processor"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'from_date', 'to_date', 'pdf_password']
        missing_fields = [field for field in required_fields if field not in data or not data[field]]
        
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Start Gmail extraction using your actual processor
        global processing_status
        processing_status.update({
            'status': 'processing',
            'progress': 0,
            'message': 'Connecting to Gmail...',
            'results': None,
            'error': None
        })
        
        def gmail_extraction_process():
            try:
                # Use your actual Gmail extraction method
                extracted_count = processor.process_gmail_extraction_with_params(
                    data['email'], 
                    data['password'], 
                    data['from_date'], 
                    data['to_date'], 
                    data['pdf_password']
                )
                
                if extracted_count > 0:
                    processing_status.update({
                        'progress': 50,
                        'message': f'Extracted {extracted_count} PDF(s). Processing transactions...'
                    })
                    
                    # Process the extracted PDFs
                    combined_df = processor.process_all_pdfs()
                    
                    if combined_df is not None and not combined_df.empty:
                        # Save results
                        json_filename = processor.save_results(combined_df)
                        
                        processing_status.update({
                            'status': 'completed',
                            'progress': 100,
                            'message': f'Successfully processed {len(combined_df)} transactions from Gmail!'
                        })
                    else:
                        processing_status.update({
                            'status': 'error',
                            'error': 'No transactions found in extracted PDFs'
                        })
                else:
                    processing_status.update({
                        'status': 'error',
                        'error': 'No PDF files extracted from Gmail'
                    })
                
            except Exception as e:
                processing_status.update({
                    'status': 'error',
                    'error': f'Gmail extraction error: {str(e)}'
                })
        
        # Start background processing
        thread = threading.Thread(target=gmail_extraction_process)
        thread.start()
        
        return jsonify({
            'message': 'Gmail extraction started successfully',
            'status': 'processing'
        })
    
    except Exception as e:
        logger.error(f"Gmail extraction error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Keep your existing error handlers...
@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'API endpoint not found'}), 404
    return render_template('index.html')

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Internal server error'}), 500
    return render_template('index.html')

if __name__ == '__main__':
    print("🏦 FinanceFlow Backend Server")
    print("=" * 50)
    print("🌐 Server starting on http://127.0.0.1:5000")
    print("📁 Upload folder:", app.config['UPLOAD_FOLDER'])
    print("🔧 Debug mode: ON")
    print("=" * 50)
    
    app.run(debug=True, host='127.0.0.1', port=5000)
