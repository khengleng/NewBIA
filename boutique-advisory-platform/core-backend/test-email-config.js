require('dotenv').config();
const { Resend } = require('resend');

// Color helpers
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

async function testEmailConfiguration() {
    console.log(`${colors.blue}📧 Starting Email Configuration Diagnostic...${colors.reset}\n`);

    // 1. Check API Key
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error(`${colors.red}❌ ERROR: RESEND_API_KEY is missing in environment variables.${colors.reset}`);
        return;
    }

    if (apiKey.startsWith('re_mock')) {
        console.warn(`${colors.yellow}⚠️ WARNING: Using a mock/test API key (${apiKey}). Emails will NOT be delivered.${colors.reset}`);
    } else {
        console.log(`${colors.green}✅ API Key found: ${apiKey.substring(0, 5)}...${colors.reset}`);
    }

    // 2. Check Sender Email
    const fromEmail = process.env.EMAIL_FROM || 'contact@cambobia.com';
    console.log(`${colors.blue}ℹ️  Using Sender: ${fromEmail}${colors.reset}`);

    // 3. Initialize Resend
    const resend = new Resend(apiKey);

    // 4. Try to send a test email
    const testRecipient = 'myerpkh@gmail.com'; // Use the email mentioned by the user previously
    console.log(`\n${colors.blue}🔄 Attempting to send test email to: ${testRecipient}...${colors.reset}`);

    try {
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [testRecipient],
            subject: 'Test Email Configuration - Do Not Reply',
            html: `
                <h1>Email Configuration Test</h1>
                <p>If you are reading this, your email configuration is working correctly!</p>
                <p><strong>Config Details:</strong></p>
                <ul>
                    <li>Sender: ${fromEmail}</li>
                    <li>Timestamp: ${new Date().toISOString()}</li>
                </ul>
            `
        });

        if (error) {
            console.error(`\n${colors.red}❌ FAILED to send email:${colors.reset}`);
            console.error(JSON.stringify(error, null, 2));

            if (error.name === 'validation_error' && error.message.includes('domain')) {
                console.log(`\n${colors.yellow}💡 DIAGNOSIS: Domain verification issue.${colors.reset}`);
                console.log(`   It seems you are trying to send from ${fromEmail} but the domain isn't verified.`);
                console.log(`   Action: Go to https://resend.com/domains and verify 'cambobia.com'.`);
            }
        } else {
            console.log(`\n${colors.green}✅ SUCCESS! Email sent successfully.${colors.reset}`);
            console.log(`   ID: ${data.id}`);
            console.log(`   Check your inbox at ${testRecipient}`);
        }

    } catch (err) {
        console.error(`\n${colors.red}❌ CRITICAL ERROR during execution:${colors.reset}`);
        console.error(err);
    }
}

testEmailConfiguration();
