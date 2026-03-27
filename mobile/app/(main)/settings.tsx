import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView
} from 'react-native'
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../src/lib/supabaseClient';

const API = 'https://www.wishflow.in'

// FIX 5 implementation adapted to fetch userId automatically
export default function WhatsAppLinkScreen() {
  const [userId,    setUserId]    = useState<string | null>(null);
  const [phone,     setPhone]     = useState('')
  const [code,      setCode]      = useState('')
  const [status,    setStatus]    = useState<'idle'|'loading'|'waiting'|'connected'|'error'>('idle')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [countdown, setCountdown] = useState(60)
  const pollRef  = useRef<any>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (status !== 'waiting' || !userId) return

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/api/whatsapp/status?userId=${userId}`)
        const data = await res.json()
        if (data.status === 'connected') {
          setStatus('connected')
          clearInterval(pollRef.current)
          clearInterval(timerRef.current)
        }
      } catch (_) {}
    }, 3000)

    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current)
          clearInterval(pollRef.current)
          setCode('')
          setStatus('error')
          setErrorMsg('Code expired. Please generate a new one.')
          return 0
        }
        return c - 1
      })
    }, 1000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(timerRef.current)
    }
  }, [status, userId])

  const handleGenerate = async () => {
    if (!userId) {
       setErrorMsg('Session error. Restart app.');
       return;
    }
    const sanitized = phone.replace(/[^0-9]/g, '')
    if (sanitized.length < 10) {
      setErrorMsg('Enter number with country code. Example: 919876543210')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    setCode('')
    try {
      const res  = await fetch(`${API}/api/whatsapp/pair`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ phoneNumber: sanitized, userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCode(data.pairingCode)
      setStatus('waiting')
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message ?? 'Something went wrong. Try again.')
    }
  }

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(code.replace('-', ''));
    Alert.alert('Copied!', 'Code copied to clipboard');
  };

  if (status === 'connected') {
    return (
      <View style={s.center}>
        <Text style={s.bigIcon}>✅</Text>
        <Text style={s.successTitle}>WhatsApp Linked!</Text>
        <Text style={s.successSub}>WishFlow will now send wishes directly from your WhatsApp.</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>Link WhatsApp</Text>
      <Text style={s.sub}>Enter your WhatsApp number with country code (digits only)</Text>
      <TextInput
        style={s.input}
        placeholder="919876543210"
        placeholderTextColor="#999"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={t => { setPhone(t); setErrorMsg('') }}
        maxLength={15}
        editable={status !== 'loading'}
      />
      {errorMsg ? <Text style={s.error}>{errorMsg}</Text> : null}
      <TouchableOpacity
        style={[s.btn, status === 'loading' && s.btnOff]}
        onPress={handleGenerate}
        disabled={status === 'loading'}
      >
        {status === 'loading'
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>{code ? '🔄 Regenerate Code' : '📲 Generate Pairing Code'}</Text>
        }
      </TouchableOpacity>
      {code && status === 'waiting' && (
        <View style={s.card}>
          <Text style={s.cardLabel}>Your Pairing Code</Text>
          <TouchableOpacity onPress={copyToClipboard}>
            <Text style={s.codeText}>{code}</Text>
            <Text style={s.tapCopy}>Tap to copy</Text>
          </TouchableOpacity>
          <Text style={s.timerText}>⏱ Expires in {countdown}s</Text>
          <View style={s.steps}>
            <Text style={s.stepsHead}>Steps to link:</Text>
            {[
              'Open WhatsApp on your phone',
              'Tap ⋮ (3 dots) → Linked Devices',
              'Tap "Link with phone number"',
              'Enter the code: ' + code,
            ].map((step, i) => (
              <Text key={i} style={s.step}>{i + 1}. {step}</Text>
            ))}
          </View>
          <ActivityIndicator style={{ marginTop: 16 }} color="#25D366" />
          <Text style={s.waitingText}>Waiting for you to enter the code…</Text>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container   : { padding: 24, paddingBottom: 48, backgroundColor: '#fff', flexGrow: 1 },
  center      : { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  title       : { fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 6 },
  sub         : { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  input       : { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 8, color: '#111' },
  error       : { color: '#e53935', fontSize: 13, marginBottom: 8 },
  btn         : { backgroundColor: '#25D366', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnOff      : { opacity: 0.55 },
  btnText     : { color: '#fff', fontSize: 16, fontWeight: '700' },
  card        : { marginTop: 28, padding: 22, backgroundColor: '#f4fff7', borderRadius: 16, borderWidth: 1.5, borderColor: '#25D366', alignItems: 'center' },
  cardLabel   : { fontSize: 13, color: '#777', marginBottom: 10 },
  codeText    : { fontSize: 40, fontWeight: '900', letterSpacing: 8, color: '#111', textAlign: 'center' },
  tapCopy     : { fontSize: 12, color: '#25D366', textAlign: 'center', marginTop: 4 },
  timerText   : { fontSize: 13, color: '#e53935', fontWeight: '600', marginTop: 12 },
  steps       : { marginTop: 20, alignSelf: 'stretch' },
  stepsHead   : { fontWeight: '800', fontSize: 14, marginBottom: 8, color: '#333' },
  step        : { fontSize: 13, color: '#555', marginBottom: 5, lineHeight: 18 },
  waitingText : { fontSize: 13, color: '#888', marginTop: 8 },
  bigIcon     : { fontSize: 72, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111' },
  successSub  : { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center', lineHeight: 22 },
})
