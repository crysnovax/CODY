const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'vcf',
    alias: ['contact','savecontact'],
    category: 'Documents',
    desc: 'Generate a contact card (.vcf file)',
    usage: `.vcf Name | Phone | Email | Org`,

    execute: async (sock, m, { args, reply }) => {
        const input = args.join(' ').trim();
        if (!input) return reply('⚉ Usage: .vcf John Doe | 2348012345678 | john@email.com | Company Inc');

        const parts = input.split('|').map(p => p.trim());
        const name = parts[0] || 'Contact';
        const phone = parts[1] || '';
        const email = parts[2] || '';
        const org = parts[3] || '';

        let vcf = 'BEGIN:VCARD\nVERSION:3.0\n';
        vcf += `FN:${name}\n`;
        if (phone) vcf += `TEL:${phone}\n`;
        if (email) vcf += `EMAIL:${email}\n`;
        if (org) vcf += `ORG:${org}\n`;
        vcf += 'END:VCARD';

        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `${name.replace(/\s/g, '_')}_${Date.now()}.vcf`);
        fs.writeFileSync(filePath, vcf);

        await sock.sendMessage(m.chat, {
            document: fs.readFileSync(filePath),
            fileName: `${name}.vcf`,
            mimetype: 'text/vcard',
            caption: `📇 Contact: ${name}\n📱 ${phone}\n📧 ${email}`
        }, { quoted: m });

        fs.unlinkSync(filePath);
    }
};
