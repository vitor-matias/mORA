export interface LiturgyHourVerse {
    id: string;
    text: string;
    audio_url: string | null;
    order: number;
}

export interface LiturgyHourPart {
    title: string;
    order: number;
    verses: LiturgyHourVerse[];
}

export interface LiturgyMemory {
    date: string;
    title: string;
    type: string;
    week_name: string | null;
    parts: LiturgyHourPart[];
}

export interface DailyLiturgy {
    date: string;
    liturgicalColor: string;
    saintOfDay: string;
    htmlContent: string;
    memories: LiturgyMemory[];
}

export async function fetchDailyLiturgy(dateStr: string): Promise<DailyLiturgy | null> {
    try {
        const query = `query DailyLiturgy($date: String!, $rite: String!) { 
            liturgyWithMemories(date: $date, rite: $rite) { 
                date 
                type 
                week_name 
                rite 
                masses {
                    title
                    date
                    text
                } 
                memories {
                    date
                    title
                    type
                    week_name
                    parts {
                        title
                        order
                        verses { id text audio_url order }
                    }
                }
            } 
        }`;

        const response = await fetch('https://apiapp.glauco.it/liturgiadashoras/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                variables: { date: dateStr, rite: 'portoghese' }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch liturgy');
        }

        const json = await response.json();
        const data = json.data?.liturgyWithMemories;

        if (!data || !data.masses || data.masses.length === 0) {
            return getFallbackLiturgy(dateStr);
        }

        const mass = data.masses[0];

        // Try to infer color from title roughly
        let color = 'Verde';
        const titleLower = mass.title.toLowerCase();
        if (titleLower.includes('quaresma') || titleLower.includes('advento')) color = 'Roxo';
        else if (titleLower.includes('mártir') || titleLower.includes('espírito santo')) color = 'Vermelho';
        else if (titleLower.includes('solenidade') || titleLower.includes('festa')) color = 'Branco';

        return {
            date: dateStr,
            liturgicalColor: color,
            saintOfDay: mass.title,
            htmlContent: mass.text,
            memories: data.memories || []
        };

    } catch (error) {
        console.error('Error fetching liturgy:', error);
        return getFallbackLiturgy(dateStr);
    }
}

function getFallbackLiturgy(dateStr: string): DailyLiturgy {
    return {
        date: dateStr,
        liturgicalColor: 'Roxo',
        saintOfDay: 'Sem Ligação',
        htmlContent: '<p>Não foi possível carregar as leituras diárias. Verifique a sua ligação à internet.</p>',
        memories: []
    }
}

export type LiturgicalColor = 'verde' | 'roxo' | 'vermelho' | 'branco' | 'rosa';

export type LiturgicalDayInfo = {
    color: LiturgicalColor;
    dayName: string;
    description: string;
};

export async function fetchLiturgicalColorFromCalendar(date: Date): Promise<LiturgicalDayInfo | null> {
    try {
        let text = '';
        const CACHE_KEY = 'mora_agenda_ics_v4';
        const CACHE_DAYS = 90;
        const now = Date.now();

        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const ageDays = (now - parsed.timestamp) / (1000 * 60 * 60 * 24);
                if (ageDays < CACHE_DAYS && parsed.text && parsed.text.includes('BEGIN:VEVENT')) {
                    text = parsed.text;
                }
            } catch (e) {
                console.warn('Failed to parse cached ICS:', e);
            }
        }

        if (!text) {
            const url = 'https://www.liturgia.pt/agenda/agenda.ics';
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) return null;
            text = await response.text();

            // Remove ICS line folding (\r\n followed by a space)
            text = text.replace(/\r?\n /g, '');

            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: now,
                    text: text
                }));
            } catch (e) {
                console.warn('Failed to cache ICS text:', e);
            }
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;

        const events = text.split('BEGIN:VEVENT');

        // Search backwards to find the last (or most relevant) event for the day, or just the first match
        for (const event of events) {
            if (event.includes(`DTSTART;VALUE=DATE:${dateString}`) || event.includes(`DTSTART:${dateString}`)) {
                const descMatch = event.match(/\r?\nDESCRIPTION:(.*?)(?=\r?\n[A-Z\-]+[;:]|$)/s);
                const summaryMatch = event.match(/\r?\nSUMMARY:(.*?)(?=\r?\n[A-Z\-]+[;:]|$)/s);

                let color: LiturgicalColor | undefined;
                let dayName = summaryMatch ? summaryMatch[1].trim() : '';
                let description = '';

                // Clean up ICS escaped characters using split/join (avoids regex escaping issues)
                const bs = String.fromCharCode(92); // backslash character
                dayName = dayName.split(bs + 'n').join(' ').split(bs + ',').join(',').split(bs + ';').join(';');

                if (descMatch) {
                    const rawDesc = descMatch[1].trim();
                    description = rawDesc.split(bs + 'n').join('\n').split(bs + ',').join(',').split(bs + ';').join(';');

                    const descLower = rawDesc.toLowerCase();
                    if (descLower.includes('verde')) color = 'verde';
                    else if (descLower.includes('roxo')) color = 'roxo';
                    else if (descLower.includes('branco')) color = 'branco';
                    else if (descLower.includes('vermelho')) color = 'vermelho';
                    else if (descLower.includes('rosa')) color = 'rosa';
                }

                if (color) {
                    return { color, dayName, description };
                }
            }
        }
    } catch (error) {
        console.error('Error fetching calendar info:', error);
    }
    return null;
}
