// ============================================
// SAGE ChatApp - Appwrite Authentication Setup
// Using Appwrite Account API for proper auth
// ============================================

class AppwriteAuthManager {
    constructor() {
        this.client = null;
        this.account = null;
        this.databases = null;
        this.currentUser = null;
        this.initializeAuth();
    }

    // Initialize Appwrite with proper error handling
    async initializeAuth() {
        try {
            // Wait for Appwrite SDK to load
            if (typeof window.Appwrite === 'undefined') {
                console.error('❌ Appwrite SDK not loaded. Check CDN in index.html');
                return false;
            }

            const { Client, Account, Databases } = window.Appwrite;

            this.client = new Client()
                .setEndpoint('https://cloud.appwrite.io/v1')
                .setProject(APPWRITE_CONFIG.projectId);

            this.account = new Account(this.client);
            this.databases = new Databases(this.client);

            console.log('✅ Appwrite Authentication initialized');

            // Check if user is already logged in
            await this.checkSession();
            return true;
        } catch (error) {
            console.error('❌ Auth initialization error:', error);
            return false;
        }
    }

    // Check if user has an active session
    async checkSession() {
        try {
            const session = await this.account.get();
            console.log('✅ Active session found:', session);
            this.currentUser = session;
            this.saveCurrentUser(session);
            return session;
        } catch (error) {
            console.log('⚠️ No active session');
            return null;
        }
    }

    // Register new user with Appwrite
    async registerUser(email, password, name) {
        try {
            if (!email || !password || !name) {
                return { success: false, message: 'All fields are required' };
            }

            if (password.length < 8) {
                return { success: false, message: 'Password must be at least 8 characters' };
            }

            // Create account with Appwrite
            const response = await this.account.create(
                'unique()', // Auto-generate ID
                email,
                password,
                name
            );

            console.log('✅ Account created:', response);

            // Auto-login after registration
            await this.loginUser(email, password);

            return {
                success: true,
                message: 'Account created successfully',
                user: response
            };
        } catch (error) {
            console.error('❌ Registration error:', error);

            let message = 'Registration failed';
            if (error.message.includes('already exists')) {
                message = 'Email already registered';
            } else if (error.message.includes('invalid')) {
                message = 'Invalid email format';
            }

            return { success: false, message };
        }
    }

    // Login user with email and password
    async loginUser(email, password) {
        try {
            if (!email || !password) {
                return { success: false, message: 'Email and password are required' };
            }

            // Create session with Appwrite
            const session = await this.account.createEmailSession(email, password);

            console.log('✅ Login successful:', session);

            // Get user info
            const user = await this.account.get();
            this.currentUser = user;
            this.saveCurrentUser(user);

            // Update user status in database
            await this.updateUserStatus('online');

            return {
                success: true,
                message: 'Login successful',
                user: user
            };
        } catch (error) {
            console.error('❌ Login error:', error);

            let message = 'Login failed';
            if (error.message.includes('Invalid')) {
                message = 'Invalid email or password';
            } else if (error.message.includes('not found')) {
                message = 'User not found';
            }

            return { success: false, message };
        }
    }

    // Logout user
    async logoutUser() {
        try {
            // Update status to offline first
            if (this.currentUser) {
                await this.updateUserStatus('offline');
            }

            // Delete current session
            await this.account.deleteSession('current');

            console.log('✅ Logout successful');

            // Clear local storage
            localStorage.removeItem('sage_current_user');
            this.currentUser = null;

            return { success: true, message: 'Logged out successfully' };
        } catch (error) {
            console.error('❌ Logout error:', error);
            return { success: false, message: 'Logout failed' };
        }
    }

    // Save current user to localStorage
    saveCurrentUser(user) {
        localStorage.setItem('sage_current_user', JSON.stringify(user));
        this.currentUser = user;
    }

    // Load current user from localStorage
    loadCurrentUser() {
        const stored = localStorage.getItem('sage_current_user');
        return stored ? JSON.parse(stored) : null;
    }

    // Get all sessions
    async getSessions() {
        try {
            const sessions = await this.account.listSessions();
            console.log('📋 Active sessions:', sessions);
            return sessions;
        } catch (error) {
            console.error('❌ Error getting sessions:', error);
            return null;
        }
    }

    // Update user status in database
    async updateUserStatus(status) {
        try {
            if (!this.currentUser || !this.databases) {
                console.warn('⚠️ Cannot update status: user or database not initialized');
                return;
            }

            // Find user document by email
            const users = await this.databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.users,
                [Query.equal('email', this.currentUser.email)]
            );

            if (users.documents.length > 0) {
                await this.databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.users,
                    users.documents[0].$id,
                    { status: status, lastLogin: new Date().toISOString() }
                );

                console.log(`✅ Status updated to: ${status}`);
            }
        } catch (error) {
            console.warn('⚠️ Could not update user status:', error);
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Verify email
    async verifyEmail(userId, secret) {
        try {
            const verification = await this.account.updateVerification(userId, secret);
            console.log('✅ Email verified:', verification);
            return { success: true, message: 'Email verified successfully' };
        } catch (error) {
            console.error('❌ Verification error:', error);
            return { success: false, message: 'Email verification failed' };
        }
    }

    // Send password reset email
    async sendPasswordReset(email) {
        try {
            await this.account.createRecovery(email, 'http://localhost:3000/reset-password');
            console.log('✅ Reset email sent to:', email);
            return { success: true, message: 'Password reset email sent' };
        } catch (error) {
            console.error('❌ Reset error:', error);
            return { success: false, message: 'Failed to send reset email' };
        }
    }

    // Complete password reset
    async completePasswordReset(userId, secret, newPassword) {
        try {
            await this.account.updateRecovery(userId, secret, newPassword);
            console.log('✅ Password reset successful');
            return { success: true, message: 'Password reset successful' };
        } catch (error) {
            console.error('❌ Reset error:', error);
            return { success: false, message: 'Password reset failed' };
        }
    }

    // Update user profile
    async updateProfile(name, email) {
        try {
            const updated = await this.account.updateName(name);
            console.log('✅ Profile updated:', updated);
            this.currentUser = updated;
            this.saveCurrentUser(updated);
            return { success: true, message: 'Profile updated', user: updated };
        } catch (error) {
            console.error('❌ Update error:', error);
            return { success: false, message: 'Profile update failed' };
        }
    }

    // Delete account
    async deleteAccount() {
        try {
            await this.account.delete();
            console.log('✅ Account deleted');
            localStorage.removeItem('sage_current_user');
            this.currentUser = null;
            return { success: true, message: 'Account deleted' };
        } catch (error) {
            console.error('❌ Delete error:', error);
            return { success: false, message: 'Account deletion failed' };
        }
    }
}

// Initialize authentication manager
let appwriteAuth = null;

// Wait for Appwrite SDK to load, then initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Give SDK time to load
    await new Promise(resolve => setTimeout(resolve, 500));

    if (typeof window.Appwrite !== 'undefined') {
        appwriteAuth = new AppwriteAuthManager();
        await appwriteAuth.initializeAuth();
        console.log('✅ Authentication system ready');
    } else {
        console.error('❌ Appwrite SDK failed to load');
    }
});

// Fallback if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!appwriteAuth && typeof window.Appwrite !== 'undefined') {
            appwriteAuth = new AppwriteAuthManager();
        }
    });
} else {
    setTimeout(async () => {
        if (!appwriteAuth && typeof window.Appwrite !== 'undefined') {
            appwriteAuth = new AppwriteAuthManager();
            await appwriteAuth.initializeAuth();
        }
    }, 500);
}
