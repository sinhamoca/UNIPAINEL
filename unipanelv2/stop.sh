#!/bin/bash

# UniPanel - Script para parar serviços

echo "🛑 Parando UniPanel..."

pkill -f "node.*index.js" 2>/dev/null && echo "✅ Backend parado"
pkill -f "vite" 2>/dev/null && echo "✅ Frontend parado"

echo "🏁 UniPanel encerrado!"
