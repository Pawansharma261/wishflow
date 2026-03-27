const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabaseAdmin = require('../db/supabaseAdmin');

const upload = multer({ 
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB Limit
});

/**
 * @route POST /api/storage/upload
 * @desc Proxy upload to Supabase using Service Role Key (bypasses RLS)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const userId = req.body.userId || 'anonymous';

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `uploads/${userId}/${fileName}`;

    // Use supabaseAdmin (Service Role) to bypass RLS
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('wishing-media')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('[StorageProxy] Error:', uploadError);
      return res.status(500).json({ success: false, message: uploadError.message });
    }

    // Get public URL
    const { data } = supabaseAdmin.storage
      .from('wishing-media')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      publicUrl: data.publicUrl
    });

  } catch (err) {
    console.error('[StorageProxy] Crash:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
