const { Resend } = require('resend');
const resend = new Resend('re_Fjw5oy7R_2Wfn5niryJcnyDrbBnKKmkM2');

(async () => {
  try {
    console.log('📧 Testing email with verified domain...');
    console.log('📤 From: contact@cambobia.com');
    console.log('📬 To: myerpkh@gmail.com');
    console.log('');

    const { data, error } = await resend.emails.send({
      from: 'contact@cambobia.com',
      to: ['myerpkh@gmail.com'],
      subject: '🎉 Domain Verified! Email Test from BIA Platform',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Success! Domain Verified!</h1>
              </div>
              <div class="content">
                <h2>Congratulations!</h2>
                <p>Your <strong>cambobia.com</strong> domain has been successfully verified!</p>
                <div class="success">
                  <p><strong>✅ Email notifications are now FULLY ACTIVE!</strong></p>
                  <p>✅ Sender: contact@cambobia.com</p>
                  <p>✅ Can send to ANY email address</p>
                  <p>✅ Production ready!</p>
                </div>
                <p><strong>Your Boutique Advisory Platform can now send:</strong></p>
                <ul>
                  <li>✅ Welcome emails when users register</li>
                  <li>✅ Password reset emails</li>
                  <li>✅ Match notifications</li>
                  <li>✅ Deal updates</li>
                  <li>✅ Booking confirmations</li>
                  <li>✅ Any custom notifications</li>
                </ul>
                <p>All emails will be sent from <strong>contact@cambobia.com</strong></p>
                <p style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 5px;">
                  <strong>🚀 Next Steps:</strong><br>
                  Your platform is now ready for production use! Users will receive professional, branded emails for all platform activities.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Boutique Advisory Platform. All rights reserved.</p>
                <p>Sent from contact@cambobia.com</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Error sending email:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    console.log('✅ Email sent successfully!');
    console.log('📧 Email ID:', data.id);
    console.log('📬 Recipient: myerpkh@gmail.com');
    console.log('📤 Sender: contact@cambobia.com');
    console.log('');
    console.log('🎉 Domain verification successful!');
    console.log('🚀 Email notifications are now FULLY OPERATIONAL!');
    console.log('');
    console.log('📥 Check your Gmail inbox: myerpkh@gmail.com');
    console.log('   (Check spam folder if not in inbox)');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
})();
