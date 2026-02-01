try {
  const playlist = await import('./routes/playlist.js');
  console.log('playlist.js importado com sucesso!');
  console.log('Rotas:', Object.keys(playlist));
} catch(e) {
  console.error('Erro ao importar playlist.js:', e.message);
  console.error(e.stack);
}
