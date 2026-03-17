/**
 * Simple baseline for breached password check.
 * In a real-world scenario, you would use an API like HaveIBeenPwned (k-Anonymity).
 */

const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'admin123', 'password123',
    '12345', '123456789', '1234567', 'admin', 'welcome', 'login'
    // ... this would be a much larger list or an external API call
];

/**
 * Check if a password is known to be breached
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
    // Basic check against common passwords
    if (commonPasswords.includes(password.toLowerCase())) {
        return true;
    }

    // In production, we should call HaveIBeenPwned API
    // Example (pseudo-code):
    // const hash = sha1(password).toUpperCase();
    // const prefix = hash.slice(0, 5);
    // const suffix = hash.slice(5);
    // const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    // ...

    return false;
}
