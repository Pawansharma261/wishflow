const supabaseAdmin = require('../db/supabaseAdmin');
const { sendWhatsAppWish, postWhatsAppStatus } = require('../services/whatsappService');
const { sendInstagramDM } = require('../services/instagramService');
const { sendPushNotification } = require('../services/pushService');

const checkAndSendWishes = async () => {
  try {
    const now = new Date().toISOString();

    const { data: wishes, error } = await supabaseAdmin
      .from('wishes')
      .select('*, users!inner(*)')
      .eq('status', 'pending')
      .lte('scheduled_datetime', now);

    if (error) {
      console.error('[WishFlow] DB fetch error:', error.message);
      throw error;
    }

    if (!wishes || wishes.length === 0) {
      console.log('[WishFlow] No due wishes found.');
      return;
    }

    console.log(`[WishFlow] Processing ${wishes.length} due wish(es)...`);

    for (const wish of wishes) {
      const {
        id,
        wish_message,
        channels,
        contact_id,
        user_id,
        is_recurring,
        recurrence_rule,
        scheduled_datetime,
        occasion_type,
      } = wish;

      const user = wish.users;

      const { data: contact } = contact_id
        ? await supabaseAdmin.from('contacts').select('*').eq('id', contact_id).single()
        : { data: null };

      const contact_name = contact?.name || 'System';

      console.log(`[WishFlow] Sending [${occasion_type}] to ${contact_name} via [${(channels || []).join(', ')}]`);

      const results = [];

      if ((channels || []).includes('whatsapp')) {
        try {
          let waRes;

          if (occasion_type === 'status_story') {
            const rawType = wish.media_type || '';
            let normalizedType = 'text';
            if (rawType.startsWith('video') || rawType === 'video') normalizedType = 'video';
            else if (rawType.startsWith('audio') || rawType === 'audio') normalizedType = 'audio';
            else if (rawType.startsWith('image') || rawType === 'image' || wish.media_url) normalizedType = 'image';

            console.log(`[WishFlow] Posting story | type: ${normalizedType} | text: ${wish_message} | mediaUrl: ${wish.media_url || 'none'}`);

            waRes = await postWhatsAppStatus(user_id, {
              text: wish_message || '',
              mediaUrl: wish.media_url || '',
              mediaType: normalizedType,
              recipients: ['status@broadcast'],
            });

            console.log(`[WishFlow] Story Result:`, JSON.stringify(waRes, null, 2));
            console.log(`[WishFlow] WhatsApp Story Posted ✅`);
          } else {
            const phoneToUse = contact?.phone_number || wish.contact_phone;
            if (phoneToUse) {
              waRes = await sendWhatsAppWish(user_id, phoneToUse, wish_message, wish.media_url || null);
              console.log(`[WishFlow] WhatsApp to ${phoneToUse}: ✅ sent (${waRes.type})`);
            } else {
              throw new Error('No phone number found for wish');
            }
          }

          if (waRes) {
            results.push({ channel: 'whatsapp', status: 'sent', payload: waRes });
          }
        } catch (error) {
          results.push({ channel: 'whatsapp', status: 'failed', payload: { error: error.message } });
          console.log(`[WishFlow] WhatsApp Error [${id}]: ❌ ${error.message}`);
        }
      }

      if ((channels || []).includes('instagram') && contact?.instagram_username) {
        if (user.instagram_access_token) {
          const res = await sendInstagramDM(contact.instagram_username, wish_message, user.instagram_access_token);
          results.push({ channel: 'instagram', status: res.success ? 'sent' : 'failed', payload: res });
          console.log(`[WishFlow] Instagram to @${contact.instagram_username}: ${res.success ? '✅ sent' : '❌ ' + (res.error?.message || res.error)}`);
        } else {
          results.push({ channel: 'instagram', status: 'failed', payload: { error: 'No Instagram access token in Settings.' } });
        }
      }

      if ((channels || []).includes('push')) {
        const { data: devices } = await supabaseAdmin
          .from('user_devices')
          .select('fcm_token')
          .eq('user_id', user_id);

        if (devices && devices.length > 0) {
          for (const device of devices) {
            const res = await sendPushNotification(device.fcm_token, 'Wish Alert', wish_message);
            results.push({ channel: 'push', status: res.success ? 'sent' : 'failed', payload: res });
          }
        } else {
          results.push({ channel: 'push', status: 'failed', payload: { error: 'No registered device found.' } });
        }
      }

      const allFailed = results.every((r) => r.status === 'failed');
      const overallStatus = allFailed ? 'failed' : 'sent';

      await supabaseAdmin.from('wishes').update({ status: overallStatus }).eq('id', id);

      for (const log of results) {
        await supabaseAdmin.from('notification_logs').insert({
          wish_id: id,
          channel: log.channel,
          status: log.status,
          response_payload: log.payload,
        });
      }

      console.log(`[WishFlow] Wish ${id} marked as: ${overallStatus}`);

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
          recurrence_rule,
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
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString();
};

module.exports = { checkAndSendWishes };
