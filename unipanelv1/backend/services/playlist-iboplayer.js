// services/playlist-iboplayer.js - Integração com IBOPlayer
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';

// Configurações de ambiente
const OCR_API_KEY = process.env.OCR_API_KEY || process.env.OCR_SPACE_API_KEY || '';
const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY || '';
const OCR_MAX_ATTEMPTS = parseInt(process.env.OCR_MAX_ATTEMPTS) || 10;

console.log(`🔧 IBOPlayer: OCR_API_KEY=${OCR_API_KEY ? 'OK' : 'NÃO CONFIGURADA'}, 2CAPTCHA=${TWOCAPTCHA_API_KEY ? 'OK' : 'NÃO CONFIGURADA'}`);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// SVG PARA PNG (Processamento de Captcha)
// ========================================

function sanitizeSvg(svgContent) {
  let svg = svgContent;
  
  // Extrair a tag <svg ...> e reconstruir sem atributos duplicados
  const svgTagMatch = svg.match(/<svg([^>]*)>/i);
  if (svgTagMatch) {
    const attrString = svgTagMatch[1];
    
    // Extrair todos os atributos
    const attrRegex = /(\w+)="([^"]*)"/g;
    const attrs = {};
    let match;
    while ((match = attrRegex.exec(attrString)) !== null) {
      const [, name, value] = match;
      // Guardar apenas a primeira ocorrência de cada atributo
      if (!attrs[name.toLowerCase()]) {
        attrs[name.toLowerCase()] = value;
      }
    }
    
    // Garantir xmlns
    if (!attrs['xmlns']) {
      attrs['xmlns'] = 'http://www.w3.org/2000/svg';
    }
    
    // Reconstruir a tag <svg>
    const newAttrs = Object.entries(attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    
    svg = svg.replace(/<svg[^>]*>/i, `<svg ${newAttrs}>`);
  }
  
  // Remover caracteres inválidos
  svg = svg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  
  return svg;
}

async function svgToPng(svgContent) {
  try {
    // Sanitizar SVG
    const cleanSvg = sanitizeSvg(svgContent);
    
    // Log para debug
    console.log('   📄 SVG original:', svgContent.substring(0, 150));
    console.log('   📄 SVG sanitizado:', cleanSvg.substring(0, 150));
    
    // Converter para PNG com fundo branco e alto contraste
    const pngBuffer = await sharp(Buffer.from(cleanSvg))
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(200, 80, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .sharpen()
      .png()
      .toBuffer();
    
    console.log('   ✅ PNG gerado, tamanho:', pngBuffer.length);
    return pngBuffer;
  } catch (error) {
    console.error('Erro ao converter SVG para PNG:', error.message);
    
    // Tentar fallback: enviar SVG direto como base64 para OCR
    // Alguns serviços aceitam SVG diretamente
    console.log('   ⚠️ Tentando fallback com SVG direto...');
    return Buffer.from(svgContent);
  }
}

// ========================================
// RESOLVER CAPTCHA COM OCR.SPACE (GRATUITO)
// ========================================

async function solveCaptchaWithOCR(svgContent, attempt = 1) {
  if (!OCR_API_KEY) {
    console.log('   ⚠️ OCR_API_KEY não configurada');
    return null;
  }
  
  try {
    let imageBase64;
    let fileType = 'PNG';
    
    try {
      // Tentar converter SVG para PNG
      const pngBuffer = await svgToPng(svgContent);
      imageBase64 = pngBuffer.toString('base64');
    } catch (convError) {
      // Fallback: enviar SVG direto
      console.log('   ⚠️ Conversão falhou, enviando SVG direto...');
      imageBase64 = Buffer.from(svgContent).toString('base64');
      fileType = 'SVG';
    }
    
    // Configurar OCR.space
    const formData = new FormData();
    formData.append('apikey', OCR_API_KEY);
    formData.append('base64Image', `data:image/${fileType.toLowerCase()};base64,${imageBase64}`);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'false');
    formData.append('scale', 'true');
    formData.append('OCREngine', attempt % 2 === 0 ? '1' : '2'); // Alternar engines
    formData.append('filetype', fileType);
    
    const response = await axios.post('https://api.ocr.space/parse/image', formData, {
      headers: formData.getHeaders(),
      timeout: 15000
    });
    
    if (response.data.IsErroredOnProcessing) {
      console.log(`   ⚠️ OCR.space erro: ${response.data.ErrorMessage}`);
      return null;
    }
    
    if (!response.data.ParsedResults?.length) {
      console.log('   ⚠️ OCR.space sem resultados');
      return null;
    }
    
    const rawText = response.data.ParsedResults[0].ParsedText || '';
    
    // Limpar e extrair caracteres
    const cleaned = rawText
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .trim();
    
    console.log(`   📄 OCR: "${rawText.trim()}" → limpo: "${cleaned}"`);
    
    // O captcha tem exatamente 2 caracteres
    if (cleaned.length >= 2) {
      const solution = cleaned.substring(0, 2);
      if (/^[A-Z0-9]{2}$/.test(solution)) {
        return solution;
      }
    }
    
    return null;
    
  } catch (error) {
    console.log(`   ⚠️ OCR.space erro: ${error.message}`);
    return null;
  }
}

// ========================================
// RESOLVER CAPTCHA COM 2CAPTCHA (PAGO)
// ========================================

async function solveCaptchaWith2Captcha(svgContent) {
  if (!TWOCAPTCHA_API_KEY || TWOCAPTCHA_API_KEY === 'sua-api-key-2captcha') {
    throw new Error('2Captcha API key não configurada');
  }
  
  const pngBuffer = await svgToPng(svgContent);
  const pngBase64 = pngBuffer.toString('base64');
  
  // Enviar para 2Captcha
  const formData = new FormData();
  formData.append('key', TWOCAPTCHA_API_KEY);
  formData.append('method', 'base64');
  formData.append('body', pngBase64);
  formData.append('numeric', '0'); // letras e números
  formData.append('min_len', '2');
  formData.append('max_len', '2');
  formData.append('json', '1');
  
  const submitResponse = await axios.post('http://2captcha.com/in.php', formData, {
    headers: formData.getHeaders()
  });
  
  if (submitResponse.data.status !== 1) {
    throw new Error(`2Captcha erro: ${submitResponse.data.request}`);
  }
  
  const captchaId = submitResponse.data.request;
  
  // Aguardar resolução
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    
    const resultResponse = await axios.get('http://2captcha.com/res.php', {
      params: {
        key: TWOCAPTCHA_API_KEY,
        action: 'get',
        id: captchaId,
        json: 1
      }
    });
    
    if (resultResponse.data.status === 1) {
      return resultResponse.data.request;
    }
    
    if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`2Captcha erro: ${resultResponse.data.request}`);
    }
  }
  
  throw new Error('2Captcha timeout');
}

// ========================================
// OBTER CAPTCHA DO SERVIDOR
// ========================================

async function getCaptcha(domain) {
  const response = await axios.get(`https://${domain}/frontend/captcha/generate`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': `https://${domain}/frontend/device/login`
    },
    timeout: 10000
  });
  
  return response.data;
}

// ========================================
// LOGIN
// ========================================

async function login(client) {
  // Limpar domain
  let domain = client.domain;
  if (!domain) {
    throw new Error('Domínio não configurado');
  }
  domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  const macAddress = client.mac_address;
  const deviceKey = client.device_key;
  
  if (!macAddress || !deviceKey) {
    throw new Error('MAC Address e Device Key são obrigatórios');
  }
  
  console.log(`🔐 IBOPlayer login: ${domain}`);
  
  // Fase 1: Tentar com OCR.space (gratuito)
  if (OCR_API_KEY) {
    console.log(`   📸 Tentando OCR.space (até ${OCR_MAX_ATTEMPTS}x)...`);
    
    for (let ocrAttempt = 1; ocrAttempt <= OCR_MAX_ATTEMPTS; ocrAttempt++) {
      try {
        const captchaData = await getCaptcha(domain);
        
        if (!captchaData.svg || !captchaData.token) {
          console.log(`   ⚠️ Captcha inválido, tentativa ${ocrAttempt}/${OCR_MAX_ATTEMPTS}`);
          continue;
        }
        
        const ocrSolution = await solveCaptchaWithOCR(captchaData.svg, ocrAttempt);
        
        if (!ocrSolution) {
          console.log(`   ⚠️ OCR falhou, tentativa ${ocrAttempt}/${OCR_MAX_ATTEMPTS}`);
          await sleep(300);
          continue;
        }
        
        console.log(`   📸 OCR.space → ${ocrSolution} (tentativa ${ocrAttempt})`);
        
        // Tentar login
        const response = await axios.post(
          `https://${domain}/frontend/device/login`,
          {
            mac_address: macAddress,
            device_key: deviceKey,
            captcha: ocrSolution,
            token: captchaData.token
          },
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Origin': `https://${domain}`,
              'Referer': `https://${domain}/frontend/device/login`
            }
          }
        );
        
        if (response.data.status === 'success') {
          const cookies = response.headers['set-cookie'] || [];
          console.log(`✅ IBOPlayer login OK! (OCR.space, tentativa ${ocrAttempt})`);
          
          return {
            domain,
            macAddress,
            deviceKey,
            deviceId: response.data.device?._id,
            cookies: cookies,
            loginTime: new Date().toISOString(),
            device: response.data.device
          };
        }
        
        // Erro de credenciais
        if (response.data.message?.includes('device information is incorrect')) {
          throw new Error('MAC Address ou Device Key incorretos');
        }
        
        // Captcha incorreto
        if (response.data.message === 'Captcha is incorrect or expired') {
          console.log(`   ⚠️ Captcha incorreto, tentativa ${ocrAttempt}/${OCR_MAX_ATTEMPTS}`);
          await sleep(300);
          continue;
        }
        
      } catch (error) {
        if (error.message.includes('MAC Address ou Device Key incorretos')) {
          throw error;
        }
        
        if (error.response?.data?.message?.includes('device information is incorrect')) {
          throw new Error('MAC Address ou Device Key incorretos');
        }
        
        console.log(`   ⚠️ Erro tentativa ${ocrAttempt}: ${error.message}`);
        await sleep(300);
      }
    }
    
    console.log(`   📸 OCR.space esgotou ${OCR_MAX_ATTEMPTS} tentativas`);
  }
  
  // Fase 2: Fallback para 2Captcha (pago)
  if (TWOCAPTCHA_API_KEY && TWOCAPTCHA_API_KEY !== 'sua-api-key-2captcha') {
    console.log('   📸 Usando 2Captcha (aguarde ~10s)...');
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const captchaData = await getCaptcha(domain);
        
        if (!captchaData.svg || !captchaData.token) {
          throw new Error('Captcha ou token não encontrado');
        }
        
        const captchaSolution = await solveCaptchaWith2Captcha(captchaData.svg);
        console.log(`   📸 2Captcha → ${captchaSolution}`);
        
        const response = await axios.post(
          `https://${domain}/frontend/device/login`,
          {
            mac_address: macAddress,
            device_key: deviceKey,
            captcha: captchaSolution,
            token: captchaData.token
          },
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Origin': `https://${domain}`,
              'Referer': `https://${domain}/frontend/device/login`
            }
          }
        );
        
        if (response.data.status === 'success') {
          const cookies = response.headers['set-cookie'] || [];
          console.log(`✅ IBOPlayer login OK! (2Captcha)`);
          
          return {
            domain,
            macAddress,
            deviceKey,
            deviceId: response.data.device?._id,
            cookies: cookies,
            loginTime: new Date().toISOString(),
            device: response.data.device
          };
        }
        
        if (response.data.message?.includes('device information is incorrect')) {
          throw new Error('MAC Address ou Device Key incorretos');
        }
        
        if (response.data.message === 'Captcha is incorrect or expired') {
          console.log(`   ⚠️ Captcha incorreto, tentativa ${attempt}/3`);
          await sleep(1000);
          continue;
        }
        
        throw new Error('Login falhou: ' + (response.data.message || JSON.stringify(response.data)));
        
      } catch (error) {
        if (error.message.includes('MAC Address ou Device Key incorretos')) {
          throw error;
        }
        
        if (attempt >= 3) {
          throw error;
        }
        
        await sleep(1000);
      }
    }
  }
  
  throw new Error('Falha no login - verifique as credenciais e configurações de captcha');
}

// ========================================
// LISTAR PLAYLISTS
// ========================================

async function listPlaylists(session) {
  const response = await axios.get(
    `https://${session.domain}/frontend/device/playlists`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      },
      timeout: 15000
    }
  );
  
  // IBOPlayer retorna "Sucess" (com erro de digitação)
  if (response.data.status !== 'Sucess' && response.data.status !== 'success') {
    throw new Error('Erro ao listar playlists');
  }
  
  const playlists = (response.data.playlists || []).map(p => ({
    id: p._id || p.id,
    name: p.playlist_name || p.name || 'Sem nome',
    url: p.playlist_url || p.url || '',
    type: p.playlist_type || p.type || 'general',
    is_protected: p.protect === 1 || p.protect === '1',
    pin: p.pin || ''
  }));
  
  return playlists;
}

// ========================================
// ADICIONAR PLAYLIST
// ========================================

async function addPlaylist(session, options) {
  const { name, url, pin = '', protect = false, type = 'general' } = options;
  
  const payload = {
    current_playlist_url_id: -1,
    password: '',
    pin: pin,
    playlist_name: name,
    playlist_type: type,
    playlist_url: url,
    protect: protect ? 1 : 0,
    username: '',
    xml_url: ''
  };
  
  const response = await axios.post(
    `https://${session.domain}/frontend/device/savePlaylist`,
    payload,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': `https://${session.domain}`,
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      },
      timeout: 15000
    }
  );
  
  if (response.data.status !== 'success') {
    throw new Error('Erro ao adicionar playlist');
  }
  
  return response.data.data;
}

// ========================================
// EDITAR PLAYLIST
// ========================================

async function editPlaylist(session, playlistId, options) {
  const { name, url, pin = '', protect = false, type = 'general' } = options;
  
  const payload = {
    current_playlist_url_id: playlistId,
    password: '',
    pin: pin,
    playlist_name: name,
    playlist_type: type,
    playlist_url: url,
    protect: protect ? 1 : 0,
    username: '',
    xml_url: ''
  };
  
  const response = await axios.post(
    `https://${session.domain}/frontend/device/savePlaylist`,
    payload,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': `https://${session.domain}`,
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      },
      timeout: 15000
    }
  );
  
  if (response.data.status !== 'success') {
    throw new Error('Erro ao editar playlist');
  }
  
  return response.data.data;
}

// ========================================
// DELETAR PLAYLIST
// ========================================

async function deletePlaylist(session, playlistId) {
  const response = await axios.delete(
    `https://${session.domain}/frontend/device/deletePlayListUrl/${playlistId}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      },
      timeout: 15000
    }
  );
  
  if (response.data.status !== 'success') {
    throw new Error('Erro ao deletar playlist');
  }
  
  return response.data;
}

// ========================================
// TESTAR SESSÃO
// ========================================

async function testSession(session) {
  try {
    const response = await axios.get(
      `https://${session.domain}/frontend/device/playlists`,
      {
        headers: {
          'Cookie': session.cookies.join('; ')
        },
        timeout: 10000
      }
    );
    return response.data.status === 'Sucess' || response.data.status === 'success';
  } catch (error) {
    return false;
  }
}

export default {
  login,
  listPlaylists,
  addPlaylist,
  editPlaylist,
  deletePlaylist,
  testSession
};
