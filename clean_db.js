const fs = require('fs');

function cleanFormDataDB(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  // Replace:
  // const { error } = await supabase.from('contacts').update({
  //   ...formData, phone: fullPhone
  // }).eq('id', editingId);
  // WITH:
  // const payload = { ...formData, phone: fullPhone }; delete payload.phone_number;
  // const { error } = await supabase.from('contacts').update(payload).eq('id', editingId);

  content = content.replace(
    /const \{ error \} = await supabase\.from\('contacts'\)\.update\(\{\s*\.\.\.formData,\s*phone:\s*fullPhone\s*\}\)\.eq\('id',\s*editingId\);/g,
    "const payload = { ...formData, phone: fullPhone }; delete payload.phone_number;\n       const { error } = await supabase.from('contacts').update(payload).eq('id', editingId);"
  );

  content = content.replace(
    /const \{ error \} = await supabase\.from\('contacts'\)\.insert\(\{\s*\.\.\.formData,\s*phone:\s*fullPhone,\s*user_id:\s*user\.id,\s*\}\);/g,
    "const payload = { ...formData, phone: fullPhone, user_id: user.id }; delete payload.phone_number;\n       const { error } = await supabase.from('contacts').insert(payload);"
  );

  fs.writeFileSync(path, content, 'utf8');
}

cleanFormDataDB('frontend/src/pages/Contacts.jsx');
cleanFormDataDB('wishflow-mobile/src/pages/Contacts.jsx');
