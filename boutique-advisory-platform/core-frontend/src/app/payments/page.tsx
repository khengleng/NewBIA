
import { Metadata } from 'next'
import Link from 'next/link'
import { CreditCard, QrCode, Banknote } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Payments | Cambobia Platform',
  description: 'Manage your payments and billing on the Cambobia platform.',
}

export default function PaymentsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 font-sans">Payments & Billing</h1>
          <p className="mt-2 text-slate-600">Choose your preferred payment method to continue.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/payments/aba" className="block h-full">
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-500 transition-all cursor-pointer group shadow-sm hover:shadow-md h-full">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">ABA PayWay / KHQR</h3>
              <p className="text-slate-600 mb-4">
                Pay quickly and securely using ABA PayWay or KHQR mobile app.
              </p>
              <span className="text-blue-600 font-medium group-hover:underline">Start payment &rarr;</span>
            </div>
          </Link>

          <div className="bg-white p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed shadow-sm h-full">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mb-4">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Debit/Credit Card</h3>
            <p className="text-slate-600">
              International Visa, Mastercard, and UnionPay. (Coming Soon)
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed shadow-sm h-full">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mb-4">
              <Banknote className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Bank Transfer</h3>
            <p className="text-slate-600">
              Direct bank transfer for large transactions. (Coming Soon)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
