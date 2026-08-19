class FinanceApp {
    constructor() {
        this.apiBaseUrl = '/api';
        this.currentPage = 'gmail-extract';
        this.transactionsData = [];
        this.chartsInitialized = false;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.setupCharts();
        this.setDefaultDates();
        
        // Initialize Lucide icons
        setTimeout(() => {
            if (window.lucide) {
                lucide.createIcons();
            }
        }, 100);
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetPage = item.dataset.page;
                
                // Update navigation
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update pages
                pages.forEach(page => page.classList.remove('active'));
                const targetElement = document.getElementById(targetPage);
                if (targetElement) {
                    targetElement.classList.add('active');
                }
                
                // Update page title
                const pageTitle = item.querySelector('span').textContent;
                document.querySelector('.page-title').textContent = pageTitle;
                
                this.currentPage = targetPage;
                
                // Page-specific actions
                if (targetPage === 'dashboard') {
                    this.loadTransactionData();
                } else if (targetPage === 'transactions') {
                    this.loadTransactionsTable();
                } else if (targetPage === 'insights') {
                    this.loadInsights();
                    setTimeout(() => this.animateInsightCards(), 100);
                }
            });
        });
    }

    setupEventListeners() {
        // Gmail form handler
        const gmailForm = document.getElementById('gmailForm');
        if (gmailForm) {
            gmailForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGmailExtraction();
            });
        }

        // Upload area functionality
        this.setupUploadArea();

        // Menu toggle for mobile
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    }

    setupUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--primary-color)';
                uploadArea.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.borderColor = 'var(--border-color)';
                uploadArea.style.backgroundColor = 'transparent';
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--border-color)';
                uploadArea.style.backgroundColor = 'transparent';
                
                const files = e.dataTransfer.files;
                this.handleFileUpload(files);
            });

            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }
    }

    setDefaultDates() {
        // Set default dates (last 2 months)
        const today = new Date();
        const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        
        const fromDateInput = document.getElementById('fromDate');
        const toDateInput = document.getElementById('toDate');
        
        if (fromDateInput) {
            fromDateInput.value = twoMonthsAgo.toISOString().split('T')[0];
        }
        if (toDateInput) {
            toDateInput.value = today.toISOString().split('T')[0];
        }
    }

    async handleGmailExtraction() {
        try {
            // Get form data
            const formData = {
                email: document.getElementById('gmailEmail').value,
                password: document.getElementById('gmailPassword').value,
                from_date: document.getElementById('fromDate').value,
                to_date: document.getElementById('toDate').value,
                pdf_password: document.getElementById('pdfPassword').value
            };

            // Validate form data
            const requiredFields = ['email', 'password', 'from_date', 'to_date', 'pdf_password'];
            const missingFields = requiredFields.filter(field => !formData[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
            }

            // Hide form and show progress
            this.showProgressCard();
            
            // Start extraction
            const response = await fetch(`${this.apiBaseUrl}/gmail-extract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Gmail extraction started!', 'success');
                this.startProgressPolling();
            } else {
                throw new Error(result.error || 'Failed to start Gmail extraction');
            }
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
            this.hideProgressCard();
        }
    }

    showProgressCard() {
        const formCard = document.getElementById('gmailFormCard');
        const progressCard = document.getElementById('progressCard');
        
        if (formCard) formCard.style.display = 'none';
        if (progressCard) {
            progressCard.style.display = 'block';
            this.resetProgress();
        }
    }

    hideProgressCard() {
        const formCard = document.getElementById('gmailFormCard');
        const progressCard = document.getElementById('progressCard');
        
        if (progressCard) progressCard.style.display = 'none';
        if (formCard) formCard.style.display = 'block';
    }

    resetProgress() {
        this.updateProgress(0, 'Starting...', 1);
    }

    updateProgress(percentage, message, activeStep = 0) {
        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }
        if (progressStatus) {
            progressStatus.textContent = message;
        }

        // Update steps
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            
            if (index + 1 < activeStep) {
                step.classList.add('completed');
            } else if (index + 1 === activeStep) {
                step.classList.add('active');
            }
        });
    }

    async startProgressPolling() {
        const poll = async () => {
            try {
                const response = await fetch(`${this.apiBaseUrl}/status`);
                const status = await response.json();
                
                // Update progress based on status
                let activeStep = 1;
                if (status.progress >= 25) activeStep = 2;
                if (status.progress >= 50) activeStep = 3;
                if (status.progress >= 75) activeStep = 4;
                if (status.progress >= 100) activeStep = 4;
                
                this.updateProgress(status.progress, status.message, activeStep);
                
                if (status.status === 'completed') {
                    this.showResults();
                    this.loadTransactionData();
                    this.loadInsights();
                } else if (status.status === 'error') {
                    this.showNotification(`Error: ${status.error}`, 'error');
                    this.hideProgressCard();
                } else if (status.status === 'processing') {
                    setTimeout(poll, 1000); // Poll every second
                }
                
            } catch (error) {
                console.error('Status polling error:', error);
                setTimeout(poll, 2000); // Try again in 2 seconds
            }
        };
        
        poll();
    }

    showResults() {
        const progressCard = document.getElementById('progressCard');
        const resultsSection = document.getElementById('resultsSection');
        
        if (progressCard) progressCard.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'block';
        
        this.showNotification('Extraction completed successfully!', 'success');
    }

    setupCharts() {
        // Spending trends chart
        const spendingCtx = document.getElementById('spendingChart');
        if (spendingCtx) {
            this.spendingChart = new Chart(spendingCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Income',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 3
                    }, {
                        label: 'Expenses',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#cbd5e1',
                                font: { size: 12, family: 'Inter' }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#64748b', font: { family: 'Inter' } },
                            grid: { color: '#475569', drawBorder: false }
                        },
                        y: {
                            ticks: { color: '#64748b', font: { family: 'Inter' } },
                            grid: { color: '#475569', drawBorder: false }
                        }
                    }
                }
            });
        }

        // Category chart
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx) {
            this.categoryChart = new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#6366f1', '#8b5cf6', '#06b6d4',
                            '#10b981', '#f59e0b', '#ef4444',
                            '#84cc16', '#f97316', '#ec4899'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#cbd5e1',
                                padding: 20,
                                font: { size: 11, family: 'Inter' }
                            }
                        }
                    }
                }
            });
        }

        this.chartsInitialized = true;
    }

    async loadTransactionData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/transactions`);
            
            if (response.ok) {
                const data = await response.json();
                this.transactionsData = data.transactions || [];
                this.updateDashboard(data.metadata);
                this.loadRecentTransactions();
                return data;
            } else {
                console.log('No transaction data available yet');
                return null;
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            return null;
        }
    }

    async loadInsights() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/insights`);
            
            if (response.ok) {
                const insights = await response.json();
                this.updateInsightsDisplay(insights);
            }
        } catch (error) {
            console.error('Error loading insights:', error);
        }
    }

    updateDashboard(metadata = {}) {
        const financialSummary = metadata.financial_summary || {};
        
        // Update stat cards with animation
        this.animateValue('.income .stat-value', financialSummary.total_credits || 0, '₹');
        this.animateValue('.expenses .stat-value', financialSummary.total_debits || 0, '₹');
        this.animateValue('.balance .stat-value', financialSummary.net_flow || 0, '₹');
        this.animateValue('.transactions .stat-value', this.transactionsData.length, '');

        // Update charts
        this.updateCharts();
    }

    animateValue(selector, targetValue, prefix = '') {
        const element = document.querySelector(selector);
        if (!element) return;

        const startValue = 0;
        const duration = 1500;
        const increment = targetValue / (duration / 16);
        let currentValue = startValue;

        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            element.textContent = prefix + this.formatCurrency(currentValue);
        }, 16);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.abs(amount));
    }

    updateCharts() {
        if (!this.chartsInitialized || !this.transactionsData.length) return;

        // Update spending trends chart
        const monthlyData = this.groupTransactionsByMonth();
        this.spendingChart.data.labels = Object.keys(monthlyData);
        this.spendingChart.data.datasets[0].data = Object.values(monthlyData).map(d => d.income);
        this.spendingChart.data.datasets[1].data = Object.values(monthlyData).map(d => d.expenses);
        this.spendingChart.update('active');

        // Update category chart
        const categoryData = this.groupTransactionsByCategory();
        this.categoryChart.data.labels = Object.keys(categoryData);
        this.categoryChart.data.datasets[0].data = Object.values(categoryData);
        this.categoryChart.update('active');
    }

    groupTransactionsByMonth() {
        const grouped = {};
        this.transactionsData.forEach(transaction => {
            const month = transaction.Date ? transaction.Date.substring(0, 7) : '2024-09';
            if (!grouped[month]) {
                grouped[month] = { income: 0, expenses: 0 };
            }
            if (transaction.Type === 'Credit') {
                grouped[month].income += transaction.Amount || 0;
            } else {
                grouped[month].expenses += transaction.Amount || 0;
            }
        });
        return grouped;
    }

    groupTransactionsByCategory() {
        const grouped = {};
        this.transactionsData
            .filter(t => t.Type === 'Debit')
            .forEach(transaction => {
                const category = transaction.Category || 'Other';
                grouped[category] = (grouped[category] || 0) + (transaction.Amount || 0);
            });
        return grouped;
    }

    loadRecentTransactions() {
        const container = document.getElementById('recentTransactions');
        if (!container) return;

        const recent = this.transactionsData.slice(0, 5);

        container.innerHTML = recent.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-icon" style="background: ${this.getCategoryColor(transaction.Category)}">
                        <i data-lucide="${this.getCategoryIcon(transaction.Category)}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${transaction.Description || 'Unknown Transaction'}</h4>
                        <p>${transaction.Category || 'Other'} • ${this.formatDate(transaction.Date)}</p>
                    </div>
                </div>
                <div class="transaction-amount ${transaction.Type ? transaction.Type.toLowerCase() : 'debit'}">
                    ${transaction.Type === 'Credit' ? '+' : '-'}₹${this.formatCurrency(transaction.Amount || 0)}
                </div>
            </div>
        `).join('');

        // Recreate icons
        setTimeout(() => {
            if (window.lucide) {
                lucide.createIcons();
            }
        }, 100);
    }

    loadTransactionsTable() {
        const tbody = document.getElementById('transactionsBody');
        if (!tbody) return;

        tbody.innerHTML = this.transactionsData.map(transaction => `
            <tr>
                <td>${this.formatDate(transaction.Date)}</td>
                <td>${transaction.Description || 'Unknown Transaction'}</td>
                <td>
                    <span class="category-badge" style="background: ${this.getCategoryColor(transaction.Category)}20; color: ${this.getCategoryColor(transaction.Category)}">
                        ${transaction.Category || 'Other'}
                    </span>
                </td>
                <td>
                    <span class="type-badge ${transaction.Type ? transaction.Type.toLowerCase() : 'debit'}">
                        ${transaction.Type || 'Debit'}
                    </span>
                </td>
                <td class="transaction-amount ${transaction.Type ? transaction.Type.toLowerCase() : 'debit'}">
                    ${transaction.Type === 'Credit' ? '+' : '-'}₹${this.formatCurrency(transaction.Amount || 0)}
                </td>
            </tr>
        `).join('');
    }

    async handleFileUpload(files) {
        try {
            this.showNotification('Uploading files...', 'info');
            
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files[]', files[i]);
            }
            
            const response = await fetch(`${this.apiBaseUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showNotification(result.message, 'success');
                closeModal();
                // Reload data after a short delay
                setTimeout(() => {
                    this.loadTransactionData();
                }, 2000);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            this.showNotification(`Upload error: ${error.message}`, 'error');
        }
    }

    updateInsightsDisplay(insights) {
        // Update spending insight
        if (insights.spending_pattern) {
            const element = document.getElementById('spendingInsight');
            if (element) {
                element.textContent = insights.spending_pattern.insight;
            }
        }
        
        // Update budget insight
        if (insights.budget_recommendation) {
            const element = document.getElementById('budgetInsight');
            if (element) {
                element.textContent = insights.budget_recommendation.insight;
            }
        }
        
        // Update savings insight
        if (insights.savings_opportunity) {
            const element = document.getElementById('savingsInsight');
            if (element) {
                element.textContent = insights.savings_opportunity.insight;
            }
        }
        
        // Update health score
        if (insights.financial_health) {
            this.animateHealthScore(insights.financial_health.score);
            const element = document.getElementById('healthInsight');
            if (element) {
                element.textContent = insights.financial_health.insight;
            }
        }
    }

    animateHealthScore(score) {
        const scoreText = document.querySelector('.score-text');
        const scoreFill = document.querySelector('.score-circle');
        
        if (!scoreText || !scoreFill) return;
        
        let currentScore = 0;
        const increment = score / 50;
        
        const timer = setInterval(() => {
            currentScore += increment;
            if (currentScore >= score) {
                currentScore = score;
                clearInterval(timer);
            }
            
            scoreText.textContent = Math.round(currentScore);
            const degrees = currentScore * 3.6;
            scoreFill.style.background = `conic-gradient(
                var(--success-color) 0deg, 
                var(--success-color) ${degrees}deg, 
                var(--border-color) ${degrees}deg
            )`;
        }, 50);
    }

    animateInsightCards() {
        const insights = document.querySelectorAll('.insight-card');
        insights.forEach((insight, index) => {
            setTimeout(() => {
                insight.style.transform = 'translateY(0)';
                insight.style.opacity = '1';
            }, index * 200);
        });
    }

    getCategoryColor(category) {
        const colors = {
            'Food & Dining': '#ef4444',
            'Shopping': '#8b5cf6',
            'Transport': '#06b6d4',
            'Income': '#10b981',
            'Entertainment': '#f59e0b',
            'Utilities': '#84cc16',
            'Healthcare': '#ec4899',
            'Education': '#6366f1'
        };
        return colors[category] || '#64748b';
    }

    getCategoryIcon(category) {
        const icons = {
            'Food & Dining': 'utensils',
            'Shopping': 'shopping-bag',
            'Transport': 'car',
            'Income': 'trending-up',
            'Entertainment': 'play-circle',
            'Utilities': 'zap',
            'Healthcare': 'heart',
            'Education': 'book-open'
        };
        return icons[category] || 'circle';
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            return new Date(dateString).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.notification');
        existing.forEach(n => n.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 4000);
    }
}

// Global functions
function showAppPasswordHelp() {
    document.getElementById('helpModal').classList.add('show');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('show');
}

function openUploadModal() {
    document.getElementById('uploadModal').classList.add('show');
}

function closeModal() {
    document.getElementById('uploadModal').classList.remove('show');
}

function viewDashboard() {
    document.querySelector('[data-page="dashboard"]').click();
}

function viewTransactions() {
    document.querySelector('[data-page="transactions"]').click();
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new FinanceApp();
});

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});
