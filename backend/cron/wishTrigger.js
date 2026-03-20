const supabaseAdmin = require('../db/supabaseAdmin');
const { sendWhatsApp } = require('../services/whatsappService');
const { sendInstagramDM } = require('../services/instagramService');
const { sendPushNotification } = require('../services/pushService');

const checkAndSendWishes = async () => {
  try {
    // 1. Fetch pending wishes that should have been sent by now
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
    console.log(`Found ${wishes?.length || 0} pending wishes due to be sent`);
    if (!wishes || wishes.length === 0) return;

    for (const wish of wishes) {
      console.log(`Processing wish for ${wish.contacts.name} (id: ${wish.id})`);
      const { id, wish_message, channels, contact_id, user_id, is_recurring, recurrence_rule, scheduled_datetime } = wish;
      const contact = wish.contacts;
      const user = wish.users;

      const results = [];

      // Channels: ["whatsapp", "instagram", "push"]
      if (channels.includes('whatsapp') && contact.phone_number) {
        // Use contact's key or user's key
        const apiKey = contact.callmebot_api_key || user.whatsapp_api_key;
        if (apiKey) {
          const res = await sendWhatsApp(contact.phone_number, wish_message, apiKey);
          results.push({ channel: 'whatsapp', status: res.success ? 'sent' : 'failed', payload: res });
        }
      }

      if (channels.includes('instagram') && contact.instagram_username && user.instagram_access_token) {
        const res = await sendInstagramDM(contact.instagram_username, wish_message, user.instagram_access_token);
        results.push({ channel: 'instagram', status: res.success ? 'sent' : 'failed', payload: res });
      }

      if (channels.includes('push')) {
        // Fetch user device tokens
        const { data: devices } = await supabaseAdmin.from('user_devices').select('fcm_token').eq('user_id', user_id);
        if (devices && devices.length > 0) {
          for (const device of devices) {
            const res = await sendPushNotification(device.fcm_token, `Wish for ${contact.name}`, wish_message);
            results.push({ channel: 'push', status: res.success ? 'sent' : 'failed', payload: res });
          }
        }
      }

      // Update wish status
      const overallStatus = results.every(r => r.status === 'sent') ? 'sent' : 'failed';
      
      await supabaseAdmin.from('wishes').update({ status: overallStatus }).eq('id', id);

      // Log results
      for (const log of results) {
        await supabaseAdmin.from('notification_logs').insert({
          wish_id: id,
          channel: log.channel,
          status: log.status,
          response_payload: log.payload
        });
      }

      // Handle Recurring Wishes
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
      }
    }
  } catch (err) {
    console.error('Wish Trigger Error:', err.message);
  }
};

const calculateNextOccurrence = (currentDateStr, rule) => {
  const date = new Date(currentDateStr);
  if (rule === 'YEARLY') {
    date.setFullYear(date.getFullYear() + 1);
  } else if (rule === 'MONTHLY') {
    date.setMonth(date.getMonth() + 1);
  } else {
    // Default to next year if unknown
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString();
};

module.exports = { checkAndSendWishes };
