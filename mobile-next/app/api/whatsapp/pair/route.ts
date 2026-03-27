import { NextRequest, NextResponse } from 'next/server'
import { createWhatsAppSocket } from '@/lib/whatsapp/socketManager'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, userId } = await req.json()

    if (!userId || !phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber and userId are required' },
        { status: 400 }
      )
    }

    const pairingCode = await createWhatsAppSocket(userId, phoneNumber)

    return NextResponse.json({
      success     : true,
      pairingCode,
      expiresInSec: 60,
      instructions: [
        'Open WhatsApp on your phone',
        'Tap the 3 dots menu → Linked Devices',
        'Tap Link with phone number',
        'Enter code: ' + pairingCode,
      ],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? 'Failed to generate pairing code' },
      { status: 500 }
    )
  }
}
