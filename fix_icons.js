const fs = require('fs');
const path = require('path');

const baseDir = 'wishflow-mobile/src/pages';
const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.jsx'));

// Replace Instagram component with Camera component in all pages, but keep the word Instagram elsewhere!
for (const file of files) {
  const fullPath = path.join(baseDir, file);
  let content = fs.readFileSync(fullPath, 'utf8');
  let altered = false;

  // Fix imports
  if (content.match(/,\s*Instagram\s*[,}](.*from\s+['"]lucide-react['"])/s)) {
    content = content.replace(/,\s*Instagram\s*([,}])/g, ", Camera$1");
    altered = true;
  }
  
  if (content.match(/\{\s*Instagram\s*[,}](.*from\s+['"]lucide-react['"])/s)) {
    content = content.replace(/\{\s*Instagram\s*([,}])/g, "{ Camera$1");
    altered = true;
  }

  // Fix JSX tags
  if (content.includes('<Instagram')) {
    content = content.replace(/<Instagram/g, '<Camera');
    altered = true;
  }

  // Wait, I might have messed up Contacts.jsx `import ... Instagram` and `Settings.jsx` `import ... Instagram`
  if (altered) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Reverted Instagram icon import to Camera in ${file}`);
  }
}
