// ============================================
// SAGE ChatApp - Appwrite Authentication Module
// User management with Appwrite backend
// ============================================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.account = null;
        this.databases = null;
        this.init();
    }

    async init() {
        // Wait for Appwrite to be initialized in appwrite-config.js
        if (window.appwriteAccount && window.appwriteDatabases) {
            this.account = window.appwriteAccount;
            this.databases = window.appwriteDatabases;
            await this.checkSession();
        } else {
            // Retry if not yet loaded
            setTimeout(() => this.init(), 100);
        }
    }

    // Check if user is already logged in
    async checkSession() {
        try {
            const user = await this.account.get();
            this.currentUser = {
                id: user.$id,
                name: user.name,
                email: user.email,
                username: user.prefs?.username || user.name.toLowerCase().replace(/\s+/g, ''),
                avatar: user.prefs?.avatar || this.generateAvatar(user.name)
            };

            console.log('✅ Session restored:', this.currentUser.name);
            showAuthContainer(false);
            initializeChat();
        } catch (error) {
            // 401 is expected if user is not logged in
            console.log('ℹ️ User not logged in (Guest session)');
            showAuthContainer(true);
        }
    }

    // Register new user
    async registerUser(name, username, password, email) {
        try {
            if (!email) {
                // Generate a fake email if not provided (not recommended for prod but fits current UI)
                email = `${username}@example.com`;
            }

            // 1. Create Identity
            const userId = 'unique()';
            await this.account.create(userId, email, password, name);

            // 2. Create Session (Login) automatically
            await this.loginUser(email, password);

            // 3. Update Preferences (store username/avatar)
            const avatar = this.generateAvatar(name);
            await this.account.updatePrefs({
                username: username,
                avatar: avatar
            });

            // 4. Create User Document in Database (for listing users)
            // Note: This requires the current user to have write permission to 'users' collection
            // Or use an Appwrite Function. For frontend-only, this relies on restrictive permissions.
            try {
                const { ID } = window.Appwrite; // Ensure we have ID available

                // We use the account ID as the document ID for 1:1 mapping
                await this.databases.createRow({
                    databaseId: APPWRITE_CONFIG.databaseId,
                    tableId: APPWRITE_CONFIG.collections.users,
                    rowId: this.currentUser.id,
                    data: {
                        username: username,
                        name: name,
                        email: email,
                        avatar: avatar,
                        status: 'online',
                        lastLogin: new Date().toISOString()
                    }
                });
            } catch (dbError) {
                console.warn('⚠️ Could not create user document:', dbError);
                // Non-fatal, auth still works
            }

            return { success: true, message: 'Account created successfully' };

        } catch (error) {
            console.error('❌ Registration error:', error);
            return { success: false, message: error.message };
        }
    }

    // Login user
    async loginUser(emailOrUsername, password) {
        try {
            // Appwrite requires email for session creation
            // If input doesn't look like email, assume it's the constructed email from username
            let email = emailOrUsername;
            if (!email.includes('@')) {
                email = `${emailOrUsername}@example.com`;
            }

            await this.account.createEmailPasswordSession(email, password);
            await this.checkSession();

            // Update status online
            this.updateUserStatus('online');

            return { success: true, message: 'Login successful' };
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, message: error.message };
        }
    }

    // Logout user
    async logout() {
        try {
            await this.updateUserStatus('offline');
            await this.account.deleteSession('current');
            this.currentUser = null;
            window.location.reload();
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    }

    // Update user status
    async updateUserStatus(status) {
        try {
            if (this.currentUser && this.databases) {
                await this.databases.updateRow({
                    databaseId: APPWRITE_CONFIG.databaseId,
                    tableId: APPWRITE_CONFIG.collections.users,
                    rowId: this.currentUser.id,
                    data: {
                        status: status,
                        lastLogin: new Date().toISOString()
                    }
                });
            }
        } catch (error) {
            console.warn('Could not update status:', error);
        }
    }

    // Get all users (from database)
    async getAllUsers() {
        try {
            const response = await this.databases.listRows({
                databaseId: APPWRITE_CONFIG.databaseId,
                tableId: APPWRITE_CONFIG.collections.users
            });
            return response.rows.map(doc => ({
                id: doc.$id,
                name: doc.name,
                username: doc.username,
                avatar: doc.avatar,
                status: doc.status
            }));
        } catch (error) {
            console.warn('Failed to fetch users:', error);
            return [];
        }
    }

    // Generate avatar initials
    generateAvatar(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.currentUser;
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// ============================================
// UI Event Handlers
// ============================================

// Switch to register form
function switchToRegister() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
}

// Switch to login form
function switchToLogin() {
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
}

// Toggle password visibility
window.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    const button = event.currentTarget; // changed to currentTarget

    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}


// Handle registration form submission
document.getElementById('registerFormElement')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    showLoading(true);

    // Note: We're passing null for email to trigger the auto-generation fallback
    // In a real app, you should add an email input field
    const result = await authManager.registerUser(name, username, password, null);

    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        // No need to switch to login, registerUser auto-logs in
    } else {
        showNotification(result.message, 'error');
    }
});

// Handle login form submission
document.getElementById('loginFormElement')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    showLoading(true);

    const result = await authManager.loginUser(username, password);

    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        // initializeChat is called in checkSession
    } else {
        showNotification(result.message, 'error');
    }
});

// ============================================
// UI Helper Functions
// ============================================

function showAuthContainer(show) {
    const authContainer = document.getElementById('authContainer');
    const chatContainer = document.getElementById('chatContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Hide loading info when showing containers
    loadingSpinner.classList.remove('active');

    if (show) {
        authContainer.classList.add('active');
        chatContainer.classList.remove('active');
    } else {
        authContainer.classList.remove('active');
        chatContainer.classList.add('active');
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    notification.innerHTML = `
        <i class="${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.add('active');
    } else {
        spinner.classList.remove('active');
    }
}

// Update password strength meter
document.getElementById('registerPassword')?.addEventListener('input', (e) => {
    const password = e.target.value;
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');

    let strength = 0;
    let color = '#f04747';
    let text = 'Weak';

    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;

    if (strength <= 2) {
        color = '#f04747';
        text = 'Weak';
    } else if (strength <= 3) {
        color = '#faa61a';
        text = 'Fair';
    } else if (strength <= 4) {
        color = '#43b581';
        text = 'Good';
    } else {
        color = '#00d4ff';
        text = 'Strong';
    }

    if (strengthBar) strengthBar.style.background = `linear-gradient(90deg, ${color}, ${color}cc)`;
    if (strengthText) {
        strengthText.textContent = `Password strength: ${text}`;
        strengthText.style.color = color;
    }
});
