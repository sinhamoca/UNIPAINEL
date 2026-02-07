// =====================================================
// DEBUG SIMPLES - IBO REVENDA
// Não precisa de dependências do projeto
// Executar: node debug-ibo-simple.js
// =====================================================

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DB_PATH = '/root/unipanel/backend/database/unipanel.db';
const ACCOUNT_ID = 1;

async function runSql(sql) {
  try {
    const { stdout } = await execAsync(`sqlite3 "${DB_PATH}" "${sql}"`);
    return stdout.trim();
  } catch (e) {
    return null;
  }
}

async function debug() {
  console.log('🔍 DEBUG IBO REVENDA (SIMPLES)\n');
  console.log('='.repeat(60));
  
  // 1. Verificar conta
  console.log('\n📋 1. VERIFICANDO CONTA...');
  const accountName = await runSql(`SELECT name FROM gerencia_accounts WHERE id = ${ACCOUNT_ID}`);
  const accountEmail = await runSql(`SELECT email FROM gerencia_accounts WHERE id = ${ACCOUNT_ID}`);
  
  if (!accountName) {
    console.log('   ❌ Conta não encontrada!');
    const accounts = await runSql('SELECT id, name FROM gerencia_accounts');
    console.log('   Contas:', accounts);
    return;
  }
  
  console.log(`   ✅ Conta: ${accountName} (${accountEmail})`);
  
  // 2. Verificar cache
  console.log('\n📦 2. CACHE:');
  const total = await runSql(`SELECT COUNT(*) FROM gerencia_users_cache WHERE account_id = ${ACCOUNT_ID}`);
  console.log(`   Total no cache: ${total}`);
  
  // 3. Problemas
  console.log('\n⚠️ 3. PROBLEMAS NO CACHE:');
  const noName = await runSql(`SELECT COUNT(*) FROM gerencia_users_cache WHERE account_id = ${ACCOUNT_ID} AND (server_name IS NULL OR server_name = '')`);
  console.log(`   Sem server_name: ${noName} ${parseInt(noName) > 0 ? '❌' : '✅'}`);
  
  const noRaw = await runSql(`SELECT COUNT(*) FROM gerencia_users_cache WHERE account_id = ${ACCOUNT_ID} AND (raw_data IS NULL OR raw_data = '')`);
  console.log(`   Sem raw_data: ${noRaw} ${parseInt(noRaw) > 0 ? '❌' : '✅'}`);
  
  // 4. Amostra
  console.log('\n📋 4. AMOSTRA (primeiros 3):');
  const sample = await runSql(`SELECT remote_id, server_name, mac_device FROM gerencia_users_cache WHERE account_id = ${ACCOUNT_ID} LIMIT 3`);
  if (sample) {
    sample.split('\n').forEach((line, i) => {
      const [id, name, mac] = line.split('|');
      console.log(`   [${i+1}] ID: ${id}, Nome: ${name || '❌NULL'}, MAC: ${mac || 'N/A'}`);
    });
  } else {
    console.log('   Cache vazio');
  }
  
  // 5. Diagnóstico
  console.log('\n💡 5. DIAGNÓSTICO:');
  
  if (parseInt(total) === 0) {
    console.log('   ⚠️ Cache vazio');
  } else if (parseInt(noName) > 0 || parseInt(noRaw) > 0) {
    console.log('   ❌ CACHE COM DADOS INCOMPLETOS!');
    console.log('');
    console.log('   📌 SOLUÇÃO:');
    console.log(`   sqlite3 ${DB_PATH} "DELETE FROM gerencia_users_cache;"`);
  } else {
    console.log('   ✅ Cache parece OK');
    console.log('   Verifique os logs durante uma edição');
  }
  
  console.log('\n' + '='.repeat(60));
}

debug();
