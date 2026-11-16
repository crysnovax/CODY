const { getBotDateParts, getBotTimezone } = require('../../Utils/timezone');

module.exports = {
    name: 'calendar',
    alias: ['cal', 'month', 'kalendar'],
    desc: 'Display a premium monthly calendar',
    category: 'Tools',
    usage: '.calendar [month] [year]',
    reactions: { start: '📅', success: '🔖', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const today = getBotDateParts(new Date());
        const currentMonth = Number(today.month);
        const currentYear = Number(today.year);
        let month = parseInt(args[0], 10) || currentMonth;
        let year = parseInt(args[1], 10) || currentYear;

        if (month < 1 || month > 12) {
            month = currentMonth;
            year = currentYear;
        }

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const monthName = monthNames[month - 1];
        const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
        const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const tableRows = [dayNames];

        let day = 1;
        for (let week = 0; week < 6; week++) {
            const row = [];
            for (let weekday = 0; weekday < 7; weekday++) {
                if ((week === 0 && weekday < firstDay) || day > totalDays) {
                    row.push('');
                } else {
                    const isToday = day === Number(today.day) && month === currentMonth && year === currentYear;
                    row.push(isToday ? `★${day}★` : String(day));
                    day++;
                }
            }
            tableRows.push(row);
            if (day > totalDays) break;
        }

        await sock.sendMessage(m.chat, { react: { text: '📅', key: m.key } });
        await sock.sendRichAIResponse(m.chat, {
            table: {
                title: `📆 ${monthName} ${year}`,
                headers: tableRows[0],
                rows: tableRows.slice(1),
                headerText: `## 📅 ${monthName} ${year}`,
                footerText: `💡 Today: ${today.day} ${monthNames[currentMonth - 1]} ${currentYear} (${getBotTimezone()}) | ${prefix}calendar ${month === 12 ? 1 : month + 1} ${month === 12 ? year + 1 : year}`,
            },
        }, m);
        await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
    }
};
