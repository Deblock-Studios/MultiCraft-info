function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

exports.handler = async function (event) {
  const code = (event.queryStringParameters && event.queryStringParameters.code) || '';

  if (!code) {
    return {
      statusCode: 302,
      headers: { Location: 'https://multicraf-info.netlify.app/' },
      body: ''
    };
  }

  try {
    const res = await fetch('https://multicraft-servers.creatif-france.workers.dev');
    const data = await res.json();

    let foundServer = null;
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.server_id === code) { foundServer = node; return; }
      Object.keys(node).forEach(function (k) { walk(node[k]); });
    }
    walk(data);

    if (foundServer) {
      const name = foundServer.server_name || 'Serveur MultiCraft';
      const description = foundServer.description || 'Aucune description disponible.';
      const players = foundServer.online ? (foundServer.connected_players || 0) : 0;
      const maxPlayers = foundServer.max_players != null ? foundServer.max_players : '?';
      const title = name + ' — MultiCraft Info';
      const desc = 'Serveur MultiCraft — ' + name + ' (' + players + '/' + maxPlayers + ' joueurs) : ' + description.substring(0, 200);
      const imageUrl = 'https://multicraf-info.netlify.app/og-image.png';
      const pageUrl = 'https://multicraf-info.netlify.app/#serveurs?server=' + encodeURIComponent(code);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<title>' + escapeHtml(title) + '</title>\n'
          + '<meta property="og:title" content="' + escapeHtml(title) + '">\n'
          + '<meta property="og:description" content="' + escapeHtml(desc) + '">\n'
          + '<meta property="og:image" content="' + escapeHtml(imageUrl) + '">\n'
          + '<meta property="og:url" content="' + escapeHtml(pageUrl) + '">\n'
          + '<meta property="og:type" content="website">\n'
          + '<meta property="og:site_name" content="MultiCraft Info">\n'
          + '<meta name="twitter:card" content="summary_large_image">\n'
          + '<meta name="twitter:image" content="' + escapeHtml(imageUrl) + '">\n'
          + '<meta name="twitter:title" content="' + escapeHtml(title) + '">\n'
          + '<meta name="twitter:description" content="' + escapeHtml(desc) + '">\n'
          + '<meta http-equiv="refresh" content="0;url=' + escapeHtml(pageUrl) + '">\n'
          + '</head>\n<body>\n<p>Redirection vers <a href="' + escapeHtml(pageUrl) + '">' + escapeHtml(name) + '</a>...</p>\n</body>\n</html>'
      };
    }
  } catch (e) {
    // Fall through to default redirect
  }

  return {
    statusCode: 302,
    headers: { Location: 'https://multicraf-info.netlify.app/' },
    body: ''
  };
};
