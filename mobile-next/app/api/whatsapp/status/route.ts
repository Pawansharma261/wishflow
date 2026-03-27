import { NextRequest, NextResponse } from 'next/server'
import { sockets, waStatus, pairingCodes } from '@/lib/whatsapp/socketManager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  return NextResponse.json({
    status     : waStatus.get(userId)      ?? 'disconnected',
    pairingCode: pairingCodes.get(userId)  ?? null,
    phone      : sockets.get(userId)?.user?.id?.split(':')?.[0] ?? null,
  })
}
