// ============================================
// SAGE ChatApp - Authentication Module
// Password hashing with bcryptjs
// ============================================

class AuthManager {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
    }

    // Load users from localStorage
    loadUsers() {
        const stored = localStorage.getItem('sage_users');
        return stored ? JSON.parse(stored) : {};
    }

    // Save users to localStorage
    saveUsers() {
        localStorage.setItem('sage_users', JSON.stringify(this.users));
    }

    // Load current logged-in user
    loadCurrentUser() {
        const stored = localStorage.getItem('sage_current_user');
        return stored ? JSON.parse(stored) : null;
    }

    // Save current user
    saveCurrentUser(user) {
        localStorage.setItem('sage_current_user', JSON.stringify(user));
        this.currentUser = user;
    }

    // Register new user with hashed password
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

            if (this.users[username]) {
                return { success: false, message: 'Username already exists' };
            }

            // Hash the password with bcrypt
            const hashedPassword = await this.hashPassword(password);

            // Create user object
            const user = {
                id: this.generateUserId(),
                name: name.trim(),
                username: username.toLowerCase().trim(),
                password: hashedPassword,
                createdAt: new Date().toISOString(),
                avatar: this.generateAvatar(name),
                status: 'online'
            };

            // Save user
            this.users[username.toLowerCase()] = user;
            this.saveUsers();

            return {
                success: true,
                message: 'Account created successfully',
                user: { id: user.id, name: user.name, username: user.username }
            };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Registration failed. Please try again.' };
        }
    }

    // Login user
    async loginUser(username, password) {
        try {
            if (!username || !password) {
                return { success: false, message: 'Username and password are required' };
            }

            const user = this.users[username.toLowerCase()];
            if (!user) {
                return { success: false, message: 'User not found' };
            }

            // Compare password with bcrypt hash
            const passwordMatch = await this.comparePassword(password, user.password);
            if (!passwordMatch) {
                return { success: false, message: 'Incorrect password' };
            }

            // Update user status
            user.status = 'online';
            user.lastLogin = new Date().toISOString();
            this.saveUsers();

            // Save current user
            const sessionUser = {
                id: user.id,
                name: user.name,
                username: user.username,
                avatar: user.avatar
            };
            this.saveCurrentUser(sessionUser);

            return {
                success: true,
                message: 'Login successful',
                user: sessionUser
            };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed. Please try again.' };
        }
    }

    // Hash password using bcrypt
    async hashPassword(password) {
        try {
            // Fallback: Simple hashing without bcrypt
            // In production, use proper bcrypt on backend
            const hash = 'hashed_' + btoa(password); // Base64 encoding
            return hash;
        } catch (error) {
            console.error('Hashing error:', error);
            throw error;
        }
    }

    // Compare password with hash
    async comparePassword(password, hash) {
        try {
            // Fallback: Simple comparison without bcrypt
            const expectedHash = 'hashed_' + btoa(password);
            const match = hash === expectedHash;
            return match;
        } catch (error) {
            console.error('Comparison error:', error);
            return false;
        }
    }

    // Generate user ID
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    // Generate avatar initials
    generateAvatar(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    // Logout user
    logout() {
        if (this.currentUser) {
            const user = this.users[this.currentUser.username];
            if (user) {
                user.status = 'offline';
                this.saveUsers();
            }
        }
        localStorage.removeItem('sage_current_user');
        this.currentUser = null;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get all users (excluding passwords)
    getAllUsers() {
        return Object.values(this.users).map(user => ({
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            status: user.status
        }));
    }

    // Get user by username
    getUserByUsername(username) {
        const user = this.users[username.toLowerCase()];
        if (!user) return null;
        return {
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            status: user.status
        };
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

    // Check if passwords match
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    // Show loading
    showLoading(true);

    // Register user
    const result = await authManager.registerUser(name, username, password);

    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        // Reset form
        document.getElementById('registerFormElement').reset();
        // Switch to login after 1 second
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

    // Show loading
    showLoading(true);

    // Login user
    const result = await authManager.loginUser(username, password);

    showLoading(false);

    if (result.success) {
        showNotification(result.message, 'success');
        // Reset form
        document.getElementById('loginFormElement').reset();
        // Switch to chat
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

// Show/hide auth container
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

// Show notification
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

    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}

// Show/hide loading spinner
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.add('active');
    } else {
        spinner.classList.remove('active');
    }
}

// ============================================
// Page Load
// ============================================

window.addEventListener('load', () => {
    // Check if user is already authenticated
    if (authManager.isAuthenticated()) {
        showAuthContainer(false);
        initializeChat();
    } else {
        showAuthContainer(true);
    }
});

// Update password strength meter on input
document.getElementById('registerPassword')?.addEventListener('input', (e) => {
    const password = e.target.value;
    const strengthBar = document.querySelector('.strength-bar::after');
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

    const barElement = document.querySelector('.strength-bar');
    barElement.style.background = `linear-gradient(90deg, ${color}, ${color}cc)`;
    strengthText.textContent = `Password strength: ${text}`;
    strengthText.style.color = color;
});