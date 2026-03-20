const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'firebase-key.json');
if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    try {
        const json = JSON.parse(content);
        if (json.private_key) {
            // Remove any spaces inside the private key string (excluding header/footer parts if any, 
            // but usually we can just remove all spaces and then fix the header/footer)
            let pk = json.private_key;
            
            // Standard PEM header/footer
            const header = '-----BEGIN PRIVATE KEY-----';
            const footer = '-----END PRIVATE KEY-----';
            
            if (pk.includes(header) && pk.includes(footer)) {
                const start = pk.indexOf(header) + header.length;
                const end = pk.indexOf(footer);
                let mid = pk.substring(start, end);
                // Remove all whitespace from mid
                mid = mid.replace(/\s/g, '');
                // Correctly restore newlines (optional, but good for readability)
                // Actually admin SDK accepts it without newlines if it's a valid PEM string
                json.private_key = header + '\n' + mid.match(/.{1,64}/g).join('\n') + '\n' + footer + '\n';
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
        console.log("Cleaned firebase-key.json successfully");
    } catch (e) {
        console.error("Failed to parse JSON:", e.message);
    }
} else {
    console.error("File not found");
}
