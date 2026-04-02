import type { Metadata } from 'next'
import { SubmitTipForm } from '@/components/public/submit-tip-form'

export const metadata: Metadata = {
  title: 'Submit a Tip',
  description: 'Confidentially report an election violence incident to our monitoring team.',
}

export default function SubmitPage() {
  return <SubmitTipForm />
}