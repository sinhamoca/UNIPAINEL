// =============================================
// KOFFICE PARSER
// Funções para parsear respostas HTML do Koffice
// =============================================

import * as cheerio from 'cheerio';

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Remove tags HTML de uma string
 */
export function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').trim();
}

/**
 * Extrai número de uma string
 */
export function extractNumber(str) {
  if (!str) return 0;
  const match = str.toString().match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// =============================================
// PARSE CLIENT ROW
// =============================================

/**
 * Parseia uma linha da tabela de clientes (DataTables)
 * 
 * Estrutura esperada:
 * row[0] = ID do cliente
 * row[1] = Usuário (pode ter HTML)
 * row[2] = Senha
 * row[3] = Data de criação
 * row[4] = Validade
 * row[5] = Revendedor
 * row[6] = Telas
 * row[7] = Nome (HTML com tooltip)
 * row[8] = Status (HTML com badge)
 */
export function parseClientRow(row) {
  if (!row || !Array.isArray(row)) {
    return null;
  }

  // Extrair nome do HTML (pode ter data-original-title)
  let name = row[7] || '';
  const nameMatch = name.match(/data-original-title="([^"]+)"/);
  if (nameMatch) {
    name = nameMatch[1];
  } else {
    name = stripHtml(name);
  }

  // Extrair username (limpar HTML se tiver)
  let username = row[1] || '';
  username = stripHtml(username);

  // Extrair status do HTML (baseado na classe do badge)
  let status = row[8] || '';
  if (status.includes('badge-success') || status.includes('bg-success')) {
    status = 'Ativo';
  } else if (status.includes('badge-danger') || status.includes('bg-danger')) {
    status = 'Bloqueado';
  } else if (status.includes('badge-warning') || status.includes('bg-warning')) {
    status = 'Expirado';
  } else {
    status = stripHtml(status) || 'Desconhecido';
  }

  return {
    id: row[0],
    username: username,
    password: row[2] || '',
    createdAt: row[3] || '',
    expiresAt: row[4] || '',
    reseller: row[5] || '',
    screens: row[6] || '',
    name: name,
    status: status
  };
}

// =============================================
// PARSE RESELLER ROW
// =============================================

/**
 * Parseia uma linha da tabela de revendedores (DataTables)
 * 
 * Estrutura esperada:
 * row[0] = ID do revendedor
 * row[1] = Username
 * row[2] = Email ou Nome
 * row[3] = Data de criação
 * row[4] = IP ou Validade
 * row[5] = Créditos
 * row[6] = Status ou ações
 */
export function parseResellerRow(row) {
  if (!row || !Array.isArray(row)) {
    return null;
  }

  // Extrair ID (pode ter HTML)
  let id = row[0];
  if (typeof id === 'string' && id.includes('<')) {
    const idMatch = id.match(/data-id="(\d+)"/);
    if (idMatch) {
      id = idMatch[1];
    } else {
      id = stripHtml(id);
    }
  }

  // Extrair username
  let username = row[1] || '';
  username = stripHtml(username);

  // Extrair nome/email
  let name = row[2] || '';
  name = stripHtml(name);

  // Extrair créditos
  let credits = row[5] || '0';
  credits = extractNumber(credits);

  // Extrair status
  let status = 'Ativo';
  const lastCol = row[row.length - 1] || '';
  if (lastCol.includes('badge-danger') || lastCol.includes('bg-danger')) {
    status = 'Inativo';
  } else if (lastCol.includes('badge-warning') || lastCol.includes('bg-warning')) {
    status = 'Pendente';
  }

  return {
    id: id,
    username: username,
    name: name,
    email: name.includes('@') ? name : '',
    createdAt: row[3] || '',
    expiry: row[4] || '',
    credits: credits,
    status: status
  };
}

// =============================================
// EXTRACT CSRF TOKEN
// =============================================

/**
 * Extrai CSRF token de uma página HTML
 */
export function extractCsrfToken(html) {
  if (!html) return null;
  
  const $ = cheerio.load(html);
  
  // Tentar diferentes seletores
  let token = $('input[name="csrf_token"]').val();
  if (!token) token = $('input[name="_token"]').val();
  if (!token) token = $('meta[name="csrf-token"]').attr('content');
  
  return token || null;
}

// =============================================
// EXTRACT CREDITS FROM PAGE
// =============================================

/**
 * Extrai saldo de créditos de uma página HTML
 */
export function extractCredits(html) {
  if (!html) return 0;
  
  const $ = cheerio.load(html);
  let credits = 0;

  // Buscar em elementos comuns
  const creditsText = $('.credits, .credit-balance, [class*="credit"]').first().text();
  const match = creditsText.match(/(\d+)/);
  if (match) {
    credits = parseInt(match[1]);
  }

  // Buscar no navbar ou sidebar
  if (credits === 0) {
    const navCredits = $('nav, .sidebar, .navbar').text().match(/cr[eé]ditos?[:\s]*(\d+)/i);
    if (navCredits) {
      credits = parseInt(navCredits[1]);
    }
  }

  // Buscar em cards de dashboard
  if (credits === 0) {
    $('[class*="card"], [class*="box"], [class*="widget"]').each((i, el) => {
      const text = $(el).text();
      if (text.toLowerCase().includes('crédit') || text.toLowerCase().includes('credit')) {
        const num = text.match(/(\d+)/);
        if (num) credits = parseInt(num[1]);
      }
    });
  }

  return credits;
}

// =============================================
// EXTRACT FAST MESSAGE DATA
// =============================================

/**
 * Extrai dados da mensagem rápida (fast_message) do cliente
 */
export function extractFastMessageData(html) {
  if (!html) return null;

  // Regex patterns para extrair dados
  const userMatch = html.match(/User(?:name)?[:\s]+([^\s<\n]+)/i);
  const passMatch = html.match(/Pass(?:word)?[:\s]+([^\s<\n]+)/i);
  const validMatch = html.match(/(?:Valid|Expir)[^:]*[:\s]+([^\n<]+)/i);
  const ssMatch = html.match(/(?:SS|Short)[^:]*[:\s]+(https?:\/\/[^\s<\n]+)/i);
  const m3uMatch = html.match(/M3U[^:]*[:\s]+(https?:\/\/[^\s<\n]+)/i);
  const epgMatch = html.match(/EPG[^:]*[:\s]+(https?:\/\/[^\s<\n]+)/i);

  // Extrair mensagem completa
  let message = html;
  const messageMatch = html.match(/<pre[^>]*>([^<]+)<\/pre>/i) || 
                       html.match(/<textarea[^>]*>([^<]+)<\/textarea>/i);
  if (messageMatch) {
    message = messageMatch[1];
  }

  return {
    user: userMatch ? userMatch[1] : null,
    password: passMatch ? passMatch[1] : null,
    validUntil: validMatch ? validMatch[1].trim() : null,
    shortUrl: ssMatch ? ssMatch[1].trim() : null,
    m3uUrl: m3uMatch ? m3uMatch[1].trim() : null,
    epgUrl: epgMatch ? epgMatch[1].trim() : null,
    rawMessage: message
  };
}

// =============================================
// CHECK IF PAGE IS LOGIN
// =============================================

/**
 * Verifica se a página é uma página de login
 */
export function isLoginPage(html) {
  if (!html) return true;
  
  return html.includes('csrf_token') && html.includes('try_login');
}

/**
 * Verifica se a página indica usuário logado
 */
export function isLoggedInPage(html) {
  if (!html) return false;
  
  return html.includes('logout') || html.includes('sair') || html.includes('dashboard');
}

// =============================================
// PARSE DATATABLE RESPONSE
// =============================================

/**
 * Parseia resposta genérica de DataTables
 */
export function parseDataTableResponse(data, rowParser) {
  let parsed;
  
  // Se for string, tentar parsear como JSON
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      return { success: false, error: 'Resposta inválida', items: [] };
    }
  } else {
    parsed = data;
  }

  // Verificar estrutura
  if (!parsed.data || !Array.isArray(parsed.data)) {
    return { success: true, items: [], total: 0 };
  }

  // Parsear cada linha
  const items = parsed.data
    .map(row => rowParser(row))
    .filter(item => item !== null);

  return {
    success: true,
    items,
    total: parsed.recordsFiltered || parsed.recordsTotal || items.length,
    draw: parsed.draw
  };
}

export default {
  stripHtml,
  extractNumber,
  parseClientRow,
  parseResellerRow,
  extractCsrfToken,
  extractCredits,
  extractFastMessageData,
  isLoginPage,
  isLoggedInPage,
  parseDataTableResponse
};
