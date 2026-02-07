// services/image-scanner.js - Serviço de OCR para extrair MAC e Device Key de imagens
import axios from 'axios';
import FormData from 'form-data';

const OCR_API_URL = 'https://api.ocr.space/parse/image';

// =============================================
// FUNÇÃO GETTER PARA OCR_API_KEY
// Necessário porque ESM imports são hoisted e executam
// ANTES do dotenv.config() no index.js
// =============================================
function getOcrApiKey() {
  const key = process.env.OCR_API_KEY || '';
  if (!key) {
    console.log('[ImageScanner] OCR_API_KEY não encontrada. Variáveis disponíveis:', 
      Object.keys(process.env).filter(k => k.includes('OCR') || k.includes('API')));
  }
  return key;
}

/**
 * Extrair MAC Address e Device Key de uma imagem (base64)
 * @param {string} base64Image - Imagem em base64 (com ou sem prefixo data:image)
 * @returns {Promise<{mac: string|null, key: string|null, raw: string, error: string|null}>}
 */
async function scanImageBase64(base64Image) {
  try {
    console.log('🔍 ImageScanner: Iniciando OCR...');
    
    const apiKey = getOcrApiKey();
    if (!apiKey) {
      throw new Error('OCR_API_KEY não configurada no .env');
    }
    
    // Garantir formato correto do base64
    let imageData = base64Image;
    if (!imageData.startsWith('data:image')) {
      imageData = `data:image/jpeg;base64,${imageData}`;
    }
    
    // Fazer OCR da imagem
    const ocrResult = await performOCR(imageData, apiKey);
    
    if (!ocrResult || !ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
      console.log('❌ OCR não retornou resultados');
      return { mac: null, key: null, raw: '', error: 'OCR não conseguiu processar a imagem' };
    }
    
    const rawText = ocrResult.ParsedResults[0].ParsedText || '';
    console.log('📄 Texto extraído:', rawText.substring(0, 200) + '...');
    
    // Extrair MAC e Key do texto
    const extracted = extractCredentials(rawText);
    
    console.log('✅ Resultado:', extracted);
    
    return {
      mac: extracted.mac,
      key: extracted.key,
      raw: rawText,
      error: null
    };
    
  } catch (error) {
    console.error('❌ Erro no ImageScanner:', error.message);
    return { mac: null, key: null, raw: '', error: error.message };
  }
}

/**
 * Realizar OCR usando OCR.space API
 * @param {string} base64Image - Imagem em base64 com prefixo data:image
 * @param {string} apiKey - Chave da API OCR.space
 */
async function performOCR(base64Image, apiKey) {
  const formData = new FormData();
  formData.append('apikey', apiKey);
  formData.append('language', 'por'); // Português
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Engine 2 é melhor para fotos
  formData.append('base64Image', base64Image);
  
  const response = await axios.post(OCR_API_URL, formData, {
    headers: {
      ...formData.getHeaders()
    },
    timeout: 30000 // 30 segundos
  });
  
  if (response.data.IsErroredOnProcessing) {
    throw new Error(response.data.ErrorMessage?.[0] || 'Erro no processamento OCR');
  }
  
  return response.data;
}

/**
 * Extrair MAC Address e Device Key do texto OCR
 * @param {string} text - Texto extraído pelo OCR
 * @returns {{mac: string|null, key: string|null}}
 */
function extractCredentials(text) {
  // Normalizar texto (remover quebras de linha extras, espaços múltiplos)
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, '\n')
    .toLowerCase();
  
  console.log('🔍 Texto normalizado para análise');
  
  let mac = null;
  let key = null;
  
  // ========== EXTRAIR MAC ADDRESS ==========
  // Padrão: XX:XX:XX:XX:XX:XX (alfanumérico, não apenas hex)
  const macRegex = /\b([a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2})\b/gi;
  
  const macMatches = normalizedText.match(macRegex);
  
  if (macMatches && macMatches.length > 0) {
    mac = macMatches[0].toUpperCase();
    console.log(`📱 MAC encontrado: ${mac}`);
  }
  
  // Se não encontrou com dois pontos, tentar com hífen
  if (!mac) {
    const macHyphenRegex = /\b([a-z0-9]{2}-[a-z0-9]{2}-[a-z0-9]{2}-[a-z0-9]{2}-[a-z0-9]{2}-[a-z0-9]{2})\b/gi;
    const macHyphenMatches = normalizedText.match(macHyphenRegex);
    if (macHyphenMatches && macHyphenMatches.length > 0) {
      mac = macHyphenMatches[0].replace(/-/g, ':').toUpperCase();
      console.log(`📱 MAC encontrado (formato hífen): ${mac}`);
    }
  }
  
  // ========== EXTRAIR DEVICE KEY ==========
  // Padrão: 6 dígitos numéricos
  const keyRegex = /\b(\d{6})\b/g;
  
  const keyMatches = normalizedText.match(keyRegex);
  
  if (keyMatches && keyMatches.length > 0) {
    // Filtrar números que provavelmente são Device Key
    const validKeys = keyMatches.filter(k => {
      // Excluir se parece ser preço (próximo de € ou $)
      const priceCheck = new RegExp(`[€$]\\s*${k}|${k}\\s*[€$]`);
      if (priceCheck.test(normalizedText)) return false;
      
      // Excluir se parece ser ano (19XX ou 20XX no início)
      if (k.startsWith('19') || k.startsWith('20')) {
        const dateCheck = new RegExp(`\\b${k}\\b.*(?:ano|year|date)`);
        if (dateCheck.test(normalizedText)) return false;
      }
      
      return true;
    });
    
    if (validKeys.length > 0) {
      key = validKeys[0];
      console.log(`🔑 Key encontrada: ${key}`);
    }
  }
  
  // Tentar encontrar key próxima a palavras-chave
  if (!key) {
    const keyContextRegex = /(?:key|chave|dispositivo|device)[\s:]*(\d{6})/gi;
    const keyContextMatch = keyContextRegex.exec(normalizedText);
    if (keyContextMatch) {
      key = keyContextMatch[1];
      console.log(`🔑 Key encontrada (por contexto): ${key}`);
    }
  }
  
  return { mac, key };
}

/**
 * Validar formato do MAC Address
 * @param {string} mac 
 * @returns {boolean}
 */
function isValidMac(mac) {
  if (!mac) return false;
  const macRegex = /^([a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2}:[a-z0-9]{2})$/i;
  return macRegex.test(mac);
}

/**
 * Validar formato do Device Key
 * @param {string} key 
 * @returns {boolean}
 */
function isValidKey(key) {
  if (!key) return false;
  return /^\d{6}$/.test(key);
}

export default {
  scanImageBase64,
  extractCredentials,
  isValidMac,
  isValidKey,
  getOcrApiKey
};
