'use client'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>

                <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 text-lg mb-6">
                        Last updated: December 2024
                    </p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
                        <p className="text-gray-300 mb-4">
                            Boutique Investment Advisory Platform collects information you provide directly to us, including:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                            <li>Personal identification information (name, email address, phone number)</li>
                            <li>Business information for SMEs</li>
                            <li>Investment preferences and portfolio information for investors</li>
                            <li>Financial documents for due diligence purposes</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
                        <p className="text-gray-300 mb-4">
                            We use the information we collect to:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                            <li>Facilitate connections between SMEs and investors</li>
                            <li>Conduct due diligence assessments</li>
                            <li>Provide platform services and support</li>
                            <li>Send important notifications and updates</li>
                            <li>Improve our services and user experience</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">3. Data Security</h2>
                        <p className="text-gray-300 mb-4">
                            We implement appropriate security measures to protect your personal information, including:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                            <li>Encryption of sensitive data in transit and at rest</li>
                            <li>Access controls and authentication requirements</li>
                            <li>Regular security audits and updates</li>
                            <li>Secure data storage practices</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">4. Contact Us</h2>
                        <p className="text-gray-300">
                            If you have any questions about this Privacy Policy, please contact us at:
                        </p>
                        <p className="text-blue-400 mt-2">
                            contact@cambobia.com
                        </p>
                    </section>
                </div>

                <div className="mt-12 pt-8 border-t border-gray-700">
                    <a
                        href="/"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        ← Back to Home
                    </a>
                </div>
            </div>
        </div>
    )
}
