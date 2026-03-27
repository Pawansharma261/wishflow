const supabaseAdmin = require('../db/supabaseAdmin');
const { sendWhatsAppWish } = require('../services/whatsappService');
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
      .lte('scheduled_for', new Date().toISOString());

    if (error) throw error;

    if (!wishes || wishes.length === 0) return;

    console.log(`[WishFlow] Processing ${wishes.length} due wish(es)...`);

    for (const wish of wishes) {
      const { id, message, channels, contact_id, user_id, is_recurring, recurrence_rule, scheduled_for } = wish;
      const contact = wish.contacts;
      const user = wish.users;

      console.log(`[WishFlow] Sending wish to ${contact.name} via [${channels.join(', ')}]`);

      const results = [];

      // === WhatsApp via Baileys (Real Device) ===
      const phoneToUse = contact.phone || wish.contact_phone;
      if (channels.includes('whatsapp') && phoneToUse) {
        try {
          // Pass media_url if exists for automatic image wishes
          const waRes = await sendWhatsAppWish(user_id, phoneToUse, message, wish.media_url || null);
          const success = waRes.success;
          
          results.push({ channel: 'whatsapp', status: success ? 'sent' : 'failed', payload: waRes });
          console.log(`[WishFlow] WhatsApp to ${phoneToUse}: ${success ? '✅ sent (' + waRes.type + ')' : '❌ failed'}`);
        } catch (error) {
          results.push({ channel: 'whatsapp', status: 'failed', payload: { error: error.message } });
          console.log(`[WishFlow] WhatsApp to ${phoneToUse}: ❌ failed (${error.message})`);
        }
      }

      // === Instagram DM via Meta Graph API ===
      if (channels.includes('instagram') && contact.instagram_username) {
        if (user.instagram_access_token) {
          const res = await sendInstagramDM(contact.instagram_username, message, user.instagram_access_token);
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
            const res = await sendPushNotification(device.fcm_token, `Wish for ${contact.name}`, message);
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
        const nextDate = calculateNextOccurrence(scheduled_for, recurrence_rule);
        await supabaseAdmin.from('wishes').insert({
          user_id,
          contact_id,
          occasion_type: wish.occasion_type,
          message,
          media_url: wish.media_url,
          scheduled_for: nextDate,
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
