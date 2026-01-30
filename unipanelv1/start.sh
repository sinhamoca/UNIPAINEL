#!/bin/bash

# UniPanel - Script de Produção
# Inicia backend e frontend

echo "🚀 Iniciando UniPanel..."

# Verificar se node está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale com: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi

# Diretório do script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Instalar dependências se necessário
if [ ! -d "$DIR/backend/node_modules" ]; then
    echo "📦 Instalando dependências do backend..."
    cd "$DIR/backend" && npm install
fi

if [ ! -d "$DIR/frontend/node_modules" ]; then
    echo "📦 Instalando dependências do frontend..."
    cd "$DIR/frontend" && npm install
fi

# Matar processos anteriores
pkill -f "node.*index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Iniciar backend em background
echo "🔧 Iniciando backend na porta 3001..."
cd "$DIR/backend"
nohup node index.js > backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Aguardar backend iniciar
sleep 2

# Verificar se backend está rodando
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Backend não iniciou corretamente. Verifique backend.log"
    exit 1
fi
echo "✅ Backend rodando!"

# Iniciar frontend em background
echo "🎨 Iniciando frontend na porta 5173..."
cd "$DIR/frontend"
nohup npm run dev -- --host 0.0.0.0 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Aguardar frontend iniciar
sleep 3

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║           🚀 UniPanel Iniciado!                   ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Frontend: http://$(hostname -I | awk '{print $1}'):5173        ║"
echo "║  Backend:  http://localhost:3001/api              ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Logs:                                            ║"
echo "║  - Backend:  tail -f backend/backend.log          ║"
echo "║  - Frontend: tail -f frontend/frontend.log        ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Para parar: ./stop.sh                            ║"
echo "╚═══════════════════════════════════════════════════╝"
