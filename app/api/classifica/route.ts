// Classifica del girone, recuperata in tempo reale dal sito della lega
// (GIV) e riformattata in JSON. Un route handler server-side evita i
// problemi di CORS che bloccherebbero un fetch diretto dal browser verso
// un dominio esterno, e può allegare le credenziali HTTP Basic Auth che
// il sito richiede senza esporle al client.

const SOURCE_URL = 'https://www.andreagreppo.it/givtonic26-27/classifica.php';

const HTML_ENTITIES: Record<string, string> = {
  '&egrave;': 'è',
  '&agrave;': 'à',
  '&ograve;': 'ò',
  '&ugrave;': 'ù',
  '&igrave;': 'ì',
  '&eacute;': 'é',
  '&amp;': '&',
  '&nbsp;': ' ',
};

function decodeEntities(text: string) {
  return text.replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m] ?? m);
}

function cellText(cellHtml: string) {
  return decodeEntities(cellHtml.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export interface StandingRow {
  pos: number;
  team: string;
  points: number;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  setRatio: string;
  pointsFor: number;
  pointsAgainst: number;
  pointRatio: string;
}

async function fetchStandings(): Promise<StandingRow[]> {
  const user = process.env.GIV_SITE_USER;
  const pass = process.env.GIV_SITE_PASSWORD;
  if (!user || !pass) {
    throw new Error('credenziali del sito non configurate (GIV_SITE_USER / GIV_SITE_PASSWORD)');
  }
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');

  const res = await fetch(SOURCE_URL, {
    headers: { Authorization: `Basic ${auth}` },
    // La classifica si muove al più una volta a settimana (dopo le partite),
    // non serve ricontrollare il sito esterno più di una volta al giorno.
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`sorgente non raggiungibile (${res.status})`);
  // La pagina dichiara charset ISO-8859-1 (Latin-1), non UTF-8: va decodificata
  // esplicitamente o i caratteri accentati (es. "Quello è") escono corrotti.
  const buffer = await res.arrayBuffer();
  const html = new TextDecoder('iso-8859-1').decode(buffer);

  // Il markup ha una tabella di layout che CONTIENE la tabella dati annidata
  // dentro una sua cella — un regex non-greedy su "<table...>...</table>"
  // si fermerebbe al primo </table> incontrato (quello della tabella interna),
  // quindi va isolata prendendo l'ULTIMO <table ...> aperto nel documento.
  const lastTableStart = html.lastIndexOf('<table');
  const tableEndIdx = html.indexOf('</table>', lastTableStart);
  if (lastTableStart === -1 || tableEndIdx === -1) {
    throw new Error('tabella classifica non trovata nella pagina sorgente');
  }
  const dataTable = html.slice(lastTableStart, tableEndIdx + '</table>'.length);

  const rowsHtml = dataTable.match(/<tr[\s\S]*?<\/tr>/g) || [];
  const rows: StandingRow[] = [];
  for (const rowHtml of rowsHtml) {
    const cellsHtml = rowHtml.match(/<td[\s\S]*?<\/td>/g) || [];
    if (cellsHtml.length < 12) continue; // righe di intestazione, meno celle
    const c = cellsHtml.map(cellText);
    rows.push({
      pos: Number(c[0]),
      team: c[1],
      points: Number(c[2]),
      played: Number(c[3]),
      won: Number(c[4]),
      lost: Number(c[5]),
      setsWon: Number(c[6]),
      setsLost: Number(c[7]),
      setRatio: c[8],
      pointsFor: Number(c[9]),
      pointsAgainst: Number(c[10]),
      pointRatio: c[11],
    });
  }
  if (rows.length === 0) throw new Error('nessuna riga di classifica trovata');
  return rows.sort((a, b) => a.pos - b.pos);
}

export async function GET() {
  try {
    const standings = await fetchStandings();
    return Response.json({ standings });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Impossibile recuperare la classifica' },
      { status: 502 }
    );
  }
}
