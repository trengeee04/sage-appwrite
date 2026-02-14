// ============================================
// SAGE ChatApp - Appwrite Authentication Module
// User management with Appwrite backend
// ============================================

// Get Query helper when it's available
function getQuery() {
    if (typeof Query !== 'undefined' && Query) {
        return Query;
    }
    return window.AppwriteQuery?.() || null;
}

class AuthManager {
    constructor() {
        this.users = {};
        this.currentUser = this.loadCurrentUser();
        this.databases = appwriteService?.getDatabases();
        this.account = appwriteService?.getAccount();
        this.waitForAppwrite();
    }

    // Wait for Appwrite to be fully initialized
    async waitForAppwrite() {
        let retries = 0;
        while ((!this.databases || !this.account) && retries < 50) {
            this.databases = appwriteService?.getDatabases();
            this.account = appwriteService?.getAccount();
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        if (!this.databases || !this.account) {
            console.warn('⚠️ Appwrite services not initialized after timeout');
        }
    }

    // Load current logged-in user from localStorage
    loadCurrentUser() {
        const stored = localStorage.getItem('sage_current_user');
        return stored ? JSON.parse(stored) : null;
    }

    // Save current user to localStorage
    saveCurrentUser(user) {
        localStorage.setItem('sage_current_user', JSON.stringify(user));
        this.currentUser = user;
    }

    // Hash password using simple crypto (use backend for production)
    async hashPassword(password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Hashing error:', error);
            // Fallback
            return 'hashed_' + btoa(password);
        }
    }

    // Compare password with hash
    async comparePassword(password, hash) {
        try {
            const newHash = await this.hashPassword(password);
            return newHash === hash;
        } catch (error) {
            console.error('Comparison error:', error);
            return false;
        }
    }

    // Register new user with Appwrite backend
    async registerUser(name, username, password) {
        try {
            // Validation
            if (!name || !username || !password) {
                return { success: false, message: 'All fields are required' };
            }

            if (username.length < 3) {
                return { success: false, message: 'Username must be at least 3 characters' };
            }

            if (password.length < 6) {
                return { success: false, message: 'Password must be at least 6 characters' };
            }

            // Check if username already exists in Appwrite
            try {
                const Query = getQuery();
                if (Query && this.databases) {
                    const existingUser = await this.databases.listDocuments(
                        APPWRITE_CONFIG.databaseId,
                        APPWRITE_CONFIG.collections.users,
                        [Query.equal('username', username.toLowerCase())]
                    );
                    
                    if (existingUser.documents.length > 0) {
                        return { success: false, message: 'Username already exists' };
                    }
                }
            } catch (error) {
                console.warn('Checking existing user:', error);
            }

            // Hash the password
            const hashedPassword = await this.hashPassword(password);

            // Create user object
            const userId = 'user_' + Math.random().toString(36).substr(2, 9);
            const userData = {
                userId: userId,
                name: name.trim(),
                username: username.toLowerCase().trim(),
                passwordHash: hashedPassword,
                avatar: this.generateAvatar(name),
                status: 'offline',
                createdAt: new Date().toISOString(),
                lastLogin: null
            };

            // Save to Appwrite
            try {
                if (this.databases) {
                    const response = await this.databases.createDocument(
                        APPWRITE_CONFIG.databaseId,
                        APPWRITE_CONFIG.collections.users,
                        userId,
                        userData
                    );

                    console.log('✅ User registered in Appwrite:', response);
                }
            } catch (error) {
                console.warn('Appwrite registration warning:', error);
                // Continue even if Appwrite fails
            }

            // Also store in local cache for quick access
            this.users[username.toLowerCase()] = userData;

            return {
                success: true,
                message: 'Account created successfully',
                user: { id: userId, name: name, username: username.toLowerCase() }
            };
        } catch (error) {
            console.error('❌ Registration error:', error);
            return { success: false, message: 'Registration failed. Please try again.' };
        }
    }

    // Login user
    async loginUser(username, password) {
        try {
            if (!username || !password) {
                return { success: false, message: 'Username and password are required' };
            }

            // Try to fetch from Appwrite first
            let user = null;
            
            try {
                const Query = getQuery();
                if (Query && this.databases) {
                    const response = await this.databases.listDocuments(
                        APPWRITE_CONFIG.databaseId,
                        APPWRITE_CONFIG.collections.users,
                        [Query.equal('username', username.toLowerCase())]
                    );

                    if (response.documents.length > 0) {
                        user = response.documents[0];
                    }
                }
            } catch (error) {
                console.warn('Fetching from Appwrite:', error);
            }

            // Fallback to local users object
            if (!user) {
                user = this.users[username.toLowerCase()];
            }

            if (!user) {
                return { success: false, message: 'User not found' };
            }

            // Verify password
            const passwordMatch = await this.comparePassword(password, user.passwordHash);
            if (!passwordMatch) {
                return { success: false, message: 'Incorrect password' };
            }

            // Update user status to online in Appwrite
            const now = new Date().toISOString();
            try {
                if (this.databases) {
                    await this.databases.updateDocument(
                        APPWRITE_CONFIG.databaseId,
                        APPWRITE_CONFIG.collections.users,
                        user.userId || user.$id,
                        {
                            status: 'online',
                            lastLogin: now
                        }
                    );
                }
            } catch (error) {
                console.warn('Updating user status:', error);
            }

            // Create session user object
            const sessionUser = {
                id: user.userId || user.$id,
                name: user.name,
                username: user.username,
                avatar: user.avatar,
                email: user.email || username
            };

            this.saveCurrentUser(sessionUser);

            return {
                success: true,
                message: 'Login successful',
                user: sessionUser
            };
        } catch (error) {
            console.error('❌ Login error:', error);
            return { success: false, message: 'Login failed. Please try again.' };
        }
    }

    // Logout user
    async logout() {
        try {
            if (this.currentUser) {
                // Update status to offline in Appwrite
                try {
                    if (this.databases) {
                        await this.databases.updateDocument(
                            APPWRITE_CONFIG.databaseId,
                            APPWRITE_CONFIG.collections.users,
                            this.currentUser.id,
                            {
                                status: 'offline'
                            }
                        );
                    }
                } catch (error) {
                    console.warn('Updating logout status:', error);
                }
            }

            localStorage.removeItem('sage_current_user');
            this.currentUser = null;
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get all users from Appwrite
    async getAllUsers() {
        try {
            if (this.databases) {
                const response = await this.databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.users
                );

                return response.documents.map(user => ({
                    id: user.userId || user.$id,
                    name: user.name,
                    username: user.username,
                    avatar: user.avatar,
                    status: user.status
                }));
            }
        } catch (error) {
            console.warn('⚠️ Fetching users:', error);
        }
        
        // Fallback to local users
        return Object.values(this.users).map(user => ({
            id: user.userId,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            status: user.status
        }));
    }

    // Get user by username from Appwrite
    async getUserByUsername(username) {
        try {
            const Query = getQuery();
            if (Query && this.databases) {
                const response = await this.databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.users,
                    [Query.equal('username', username.toLowerCase())]
                );

                if (response.documents.length > 0) {
                    const user = response.documents[0];
                    return {
                        id: user.userId || user.$id,
                        name: user.name,
                        username: user.username,
                        avatar: user.avatar,
                        status: user.status
                    };
                }
            }
        } catch (error) {
            console.warn('⚠️ Fetching user:', error);
        }
        
        return null;
    }

    // Generate avatar initials
    generateAvatar(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = event.target.closest('button');
    
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

    const result = await authManager.registerUser(name, username, password);

    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        document.getElementById('registerFormElement').reset();
        setTimeout(() => {
            switchToLogin();
        }, 1000);
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
        document.getElementById('loginFormElement').reset();
        setTimeout(() => {
            showAuthContainer(false);
            initializeChat();
        }, 500);
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

// Page Load
window.addEventListener('load', () => {
    if (authManager.isAuthenticated()) {
        showAuthContainer(false);
        initializeChat();
    } else {
        showAuthContainer(true);
    }
});

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

    strengthBar.style.background = `linear-gradient(90deg, ${color}, ${color}cc)`;
    strengthText.textContent = `Password strength: ${text}`;
    strengthText.style.color = color;
});
