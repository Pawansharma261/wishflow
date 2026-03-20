require('dotenv').config();
try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("JSON parsed successfully");
    const pk = sa.private_key;
    console.log("Original PK starts with:", pk.substring(0, 30));
    console.log("PK contains \\\\n (literal):", pk.includes('\\n'));
    console.log("PK contains \\n (newline):", pk.includes('\n'));
    
    const fixedPk = pk.replace(/\\n/g, '\n').trim();
    const crypto = require('crypto');
    try {
        crypto.createPrivateKey(fixedPk);
        console.log("Crypto: Private key is VALID PEM");
    } catch (e) {
        console.error("Crypto: Invalid PEM:", e.message);
    }
    console.log("Fixed PK starts with:", fixedPk.substring(0, 40));
    console.log("Fixed PK ends with:", fixedPk.substring(fixedPk.length - 40));
    console.log("Fixed PK length:", fixedPk.length);
    console.log("Does it have extra spaces?", fixedPk.includes(' '));
    let results = [];
    let i = fixedPk.indexOf(' ');
    while (i !== -1) {
        results.push({pos: i, context: fixedPk.substring(i - 10, i + 10).replace(/\n/g, '\\n')});
        i = fixedPk.indexOf(' ', i + 1);
    }
    console.log("All space positions:", JSON.stringify(results, null, 2));
} catch (e) {
    console.error("Parse error:", e.message);
}
