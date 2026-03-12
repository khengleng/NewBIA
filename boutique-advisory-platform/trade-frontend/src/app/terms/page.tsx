'use client'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>

                <div className="prose prose-invert max-w-none">
                    <p className="text-gray-300 text-lg mb-6">
                        Last updated: December 2024
                    </p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
                        <p className="text-gray-300 mb-4">
                            By accessing or using the Boutique Investment Advisory Platform, you agree to be bound
                            by these Terms of Service and all applicable laws and regulations.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">2. Platform Services</h2>
                        <p className="text-gray-300 mb-4">
                            Our platform provides:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                            <li>Investment matchmaking between SMEs and investors</li>
                            <li>Due diligence assessment and scoring services</li>
                            <li>Investor syndicate formation and management</li>
                            <li>Secondary trading marketplace</li>
                            <li>Community features and networking</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">3. User Responsibilities</h2>
                        <p className="text-gray-300 mb-4">
                            Users agree to:
                        </p>
                        <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                            <li>Provide accurate and complete information</li>
                            <li>Maintain the security of account credentials</li>
                            <li>Comply with all applicable laws and regulations</li>
                            <li>Not engage in fraudulent or misleading activities</li>
                            <li>Respect intellectual property rights</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">4. Investment Disclaimer</h2>
                        <p className="text-gray-300 mb-4">
                            Investment in SMEs involves significant risks. Past performance does not guarantee
                            future results. Users should conduct their own due diligence and consult with
                            financial advisors before making investment decisions.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">5. Limitation of Liability</h2>
                        <p className="text-gray-300 mb-4">
                            Boutique Investment Advisory Platform shall not be liable for any indirect,
                            incidental, special, consequential, or punitive damages arising from the use
                            of our services.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-white mb-4">6. Contact Information</h2>
                        <p className="text-gray-300">
                            For questions about these Terms of Service, please contact:
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
