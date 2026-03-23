const supabaseAdmin = require('../db/supabaseAdmin');
const { sendWhatsApp } = require('../services/whatsappService');
const { sendInstagramDM } = require('../services/instagramService');
const { sendPushNotification } = require('../services/pushService');

const checkAndSendWishes = async () => {
  try {
    // Fetch pending wishes that are due (past scheduling time)
    const { data: wishes, error } = await supabaseAdmin
      .from('wishes')
      .select(`
        *,
        contacts!inner (*),
        users!inner (*)
      `)
      .eq('status', 'pending')
      .lte('scheduled_datetime', new Date().toISOString());

    if (error) throw error;

    if (!wishes || wishes.length === 0) return;

    console.log(`[WishFlow] Processing ${wishes.length} due wish(es)...`);

    for (const wish of wishes) {
      const { id, wish_message, channels, contact_id, user_id, is_recurring, recurrence_rule, scheduled_datetime } = wish;
      const contact = wish.contacts;
      const user = wish.users;

      console.log(`[WishFlow] Sending wish to ${contact.name} via [${channels.join(', ')}]`);

      const results = [];

      // === WhatsApp via CallMeBot ===
      if (channels.includes('whatsapp') && contact.phone_number) {
        // Use contact-specific key first, fallback to user-level key
        const apiKey = contact.callmebot_api_key || user.whatsapp_api_key;
        if (apiKey) {
          const res = await sendWhatsApp(contact.phone_number, wish_message, apiKey);
          results.push({ channel: 'whatsapp', status: res.success ? 'sent' : 'failed', payload: res });
          console.log(`[WishFlow] WhatsApp to ${contact.phone_number}: ${res.success ? '✅ sent' : '❌ failed'}`);
        } else {
          results.push({ channel: 'whatsapp', status: 'failed', payload: { error: 'No CallMeBot API key configured for this contact or user.' } });
        }
      }

      // === Instagram DM via Meta Graph API ===
      if (channels.includes('instagram') && contact.instagram_username) {
        if (user.instagram_access_token) {
          const res = await sendInstagramDM(contact.instagram_username, wish_message, user.instagram_access_token);
          results.push({ channel: 'instagram', status: res.success ? 'sent' : 'failed', payload: res });
          console.log(`[WishFlow] Instagram to @${contact.instagram_username}: ${res.success ? '✅ sent' : '❌ ' + (res.error?.message || res.error)}`);
        } else {
          results.push({ channel: 'instagram', status: 'failed', payload: { error: 'No Instagram access token in Settings.' } });
        }
      }

      // === Push Notification via Firebase ===
      if (channels.includes('push')) {
        const { data: devices } = await supabaseAdmin
          .from('user_devices')
          .select('fcm_token')
          .eq('user_id', user_id);

        if (devices && devices.length > 0) {
          for (const device of devices) {
            const res = await sendPushNotification(device.fcm_token, `Wish for ${contact.name}`, wish_message);
            results.push({ channel: 'push', status: res.success ? 'sent' : 'failed', payload: res });
          }
        } else {
          results.push({ channel: 'push', status: 'failed', payload: { error: 'No registered device found for push notifications.' } });
        }
      }

      // Determine overall status: sent if at least 1 channel succeeded
      const anySent = results.some(r => r.status === 'sent');
      const allFailed = results.every(r => r.status === 'failed');
      const overallStatus = allFailed ? 'failed' : 'sent';

      // Update wish status
      await supabaseAdmin.from('wishes').update({ status: overallStatus }).eq('id', id);

      // Log each channel result
      for (const log of results) {
        await supabaseAdmin.from('notification_logs').insert({
          wish_id: id,
          channel: log.channel,
          status: log.status,
          response_payload: log.payload
        });
      }

      console.log(`[WishFlow] Wish ${id} marked as: ${overallStatus}`);

      // === Handle Recurring Wishes ===
      if (is_recurring && overallStatus === 'sent') {
        const nextDate = calculateNextOccurrence(scheduled_datetime, recurrence_rule);
        await supabaseAdmin.from('wishes').insert({
          user_id,
          contact_id,
          occasion_type: wish.occasion_type,
          wish_message,
          media_url: wish.media_url,
          scheduled_datetime: nextDate,
          channels,
          status: 'pending',
          is_recurring: true,
          recurrence_rule
        });
        console.log(`[WishFlow] Recurring wish rescheduled for ${nextDate}`);
      }
    }
  } catch (err) {
    console.error('[WishFlow] Scheduler Error:', err.message);
  }
};

const calculateNextOccurrence = (currentDateStr, rule) => {
  const date = new Date(currentDateStr);
  if (rule === 'MONTHLY') {
    date.setMonth(date.getMonth() + 1);
  } else {
    // Default to YEARLY
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString();
};

module.exports = { checkAndSendWishes };
