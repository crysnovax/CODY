module.exports = {
    name: 'delgdesc',
    alias: ['deletedescription'],
    desc: 'Delete group description',
    category: 'Tools',
    execute: async (sock, m, { isGroup, groupMeta, reply , prefix}) => {
        if (!isGroup) return reply('_*⚉ GROUP ONLY!!.*_');

        try {
            const newDesc = '';
            await sock.groupUpdateDescription(m.chat, newDesc);
            reply('_*✓ Group description has been deleted successfully.*_');
        } catch (error) {
            reply(`${prefix}Failed to delete group description: ${errormessage}`);
        }
    }
};
