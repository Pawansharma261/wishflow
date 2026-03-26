const fs = require('fs');

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // Fix display and edit
  content = content.replace(
    "let phoneNum = contact.phone_number || '';", 
    "let phoneNum = contact.phone || contact.phone_number || '';"
  );
  content = content.replace(
    "<span>{contact.phone_number || 'No phone'}</span>", 
    "<span>{contact.phone || contact.phone_number || 'No phone'}</span>"
  );
  
  // Fix update
  content = content.replace(
    "...formData, phone_number: fullPhone\n       }).eq('id', editingId);",
    "...formData, phone: fullPhone\n       }).eq('id', editingId);"
  );
  
  // Fix update (different formatting if necessary)
  content = content.replace(
    /update\(\{\s*\.\.\.formData,\s*phone_number:\s*fullPhone\s*\}\)/g,
    "update({ ...formData, phone: fullPhone })"
  );
  
  // Fix insert
  content = content.replace(
    "...formData, phone_number: fullPhone, user_id: user.id,",
    "...formData, phone: fullPhone, user_id: user.id,"
  );

  // Filter missing phone check
  content = content.replace(
    "c.phone_number?.includes(searchQuery)",
    "(c.phone || c.phone_number || '').includes(searchQuery)"
  );

  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed ' + path);
}

fixFile('frontend/src/pages/Contacts.jsx');
fixFile('wishflow-mobile/src/pages/Contacts.jsx');

// For Dashboard and MyWishes just in case, remove contacts(name) although we used multi_replace earlier
